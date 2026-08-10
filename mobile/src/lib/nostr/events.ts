import NDK, { NDKEvent, NDKFilter, NDKKind, NDKUser } from '@nostr-dev-kit/ndk';
import type { FeedNote, NostrProfile } from '@/types/nostr';
import { hexToNpub } from './keys';

/*
  Every relay read goes through fetchEventsWithTimeout instead of
  ndk.fetchEvents: fetchEvents resolves only when EVERY relay sends EOSE,
  and on mobile networks one stalled relay means the promise never settles
  (the feed spinner spins forever). This returns whatever arrived within
  the window — partial results beat no results on a phone.
*/
const FETCH_TIMEOUT_MS = 8000;

function fetchEventsWithTimeout(
  ndk: NDK,
  filter: NDKFilter,
  ms = FETCH_TIMEOUT_MS
): Promise<Set<NDKEvent>> {
  return new Promise((resolve) => {
    const events = new Map<string, NDKEvent>();
    let settled = false;
    const sub = ndk.subscribe(filter, { closeOnEose: true, groupable: false });
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        sub.stop();
      } catch {}
      resolve(new Set(events.values()));
    };
    const timer = setTimeout(done, ms);
    sub.on('event', (ev: NDKEvent) => {
      events.set(ev.id, ev);
    });
    sub.on('eose', done);
  });
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function fetchFollowList(
  ndk: NDK,
  pubkey: string
): Promise<{ follows: string[]; createdAt: number } | null> {
  // Fetch kind:3 events for the user across relays and pick the newest.
  // Relays can return stale contact lists, so we explicitly sort by created_at.
  const filter: NDKFilter = { kinds: [3 as NDKKind], authors: [pubkey] };
  const events = await fetchEventsWithTimeout(ndk, filter);
  const latest = Array.from(events).sort(
    (a, b) => (b.created_at || 0) - (a.created_at || 0)
  )[0];
  if (!latest) return null;
  const pubs = latest.tags
    .filter((t) => t[0] === 'p' && typeof t[1] === 'string' && t[1].length === 64)
    .map((t) => t[1]);
  return {
    follows: Array.from(new Set(pubs)),
    createdAt: latest.created_at || 0,
  };
}

export async function fetchFeed(
  ndk: NDK,
  authors: string[],
  limit = 40,
  until?: number
): Promise<FeedNote[]> {
  if (authors.length === 0) return [];
  const filter: NDKFilter = { kinds: [1 as NDKKind], authors, limit };
  if (until) filter.until = until;
  const events = await fetchEventsWithTimeout(ndk, filter);
  return sortNotes(events);
}

/*
  Logged-out (or empty-follows) feed: recent kind:1 notes from whatever the
  connected relays surface. Gives a first-run user something real to scroll
  before they log in / follow anyone.
*/
export async function fetchGlobalFeed(
  ndk: NDK,
  limit = 50,
  until?: number
): Promise<FeedNote[]> {
  const filter: NDKFilter = { kinds: [1 as NDKKind], limit };
  if (until) filter.until = until;
  const events = await fetchEventsWithTimeout(ndk, filter);
  return sortNotes(events);
}

function sortNotes(events: Set<NDKEvent>): FeedNote[] {
  const notes: FeedNote[] = [];
  for (const ev of events) {
    notes.push({
      id: ev.id,
      pubkey: ev.pubkey,
      content: ev.content,
      createdAt: ev.created_at || 0,
      tags: ev.tags,
    });
  }
  notes.sort((a, b) => b.createdAt - a.createdAt);
  return notes;
}

export async function fetchProfile(ndk: NDK, pubkey: string): Promise<NostrProfile | null> {
  try {
    const user = new NDKUser({ pubkey });
    user.ndk = ndk;
    const p = await withTimeout(user.fetchProfile(), FETCH_TIMEOUT_MS, null);
    if (!p) return { npub: hexToNpub(pubkey), pubkey };
    return {
      npub: hexToNpub(pubkey),
      pubkey,
      name: p.name,
      displayName: p.displayName,
      picture: p.image,
      nip05: p.nip05,
      lud16: p.lud16,
      about: p.about,
    };
  } catch {
    return { npub: hexToNpub(pubkey), pubkey };
  }
}

/*
  Batched profile fetch: one kind:0 subscription for all authors instead of
  N× NDKUser.fetchProfile round-trips (mobile radios hate chatty sockets).
*/
export async function fetchProfiles(
  ndk: NDK,
  pubkeys: string[]
): Promise<Record<string, NostrProfile>> {
  const out: Record<string, NostrProfile> = {};
  if (pubkeys.length === 0) return out;
  const filter: NDKFilter = { kinds: [0 as NDKKind], authors: Array.from(new Set(pubkeys)) };
  const events = await fetchEventsWithTimeout(ndk, filter);
  const latest: Record<string, NDKEvent> = {};
  for (const ev of events) {
    const prev = latest[ev.pubkey];
    if (!prev || (ev.created_at || 0) > (prev.created_at || 0)) latest[ev.pubkey] = ev;
  }
  for (const [pubkey, ev] of Object.entries(latest)) {
    try {
      const meta = JSON.parse(ev.content) as Record<string, string | undefined>;
      out[pubkey] = {
        npub: hexToNpub(pubkey),
        pubkey,
        name: meta.name,
        displayName: meta.display_name || meta.displayName,
        picture: meta.picture,
        nip05: meta.nip05,
        lud16: meta.lud16,
        about: meta.about,
      };
    } catch {
      out[pubkey] = { npub: hexToNpub(pubkey), pubkey };
    }
  }
  return out;
}

export async function publishNote(ndk: NDK, content: string): Promise<string> {
  const ev = new NDKEvent(ndk);
  ev.kind = 1;
  ev.content = content;
  await ev.publish();
  return ev.id;
}

export async function publishContacts(
  ndk: NDK,
  pubkeys: string[]
): Promise<{ id: string; createdAt: number }> {
  const ev = new NDKEvent(ndk);
  ev.kind = 3;
  ev.tags = pubkeys.map((p) => ['p', p]);
  ev.content = '';
  await ev.publish();
  return { id: ev.id, createdAt: ev.created_at || Math.floor(Date.now() / 1000) };
}
