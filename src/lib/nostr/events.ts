import NDK, { NDKEvent, NDKFilter, NDKKind, NDKUser } from '@nostr-dev-kit/ndk';
import type { FeedNote, NostrProfile } from '@/types/nostr';
import { hexToNpub } from './keys';

/*
  Every relay read goes through fetchEventsWithTimeout instead of
  ndk.fetchEvents: fetchEvents resolves only when EVERY relay sends EOSE,
  so a single dead relay (a failed websocket never EOSEs) hangs the promise
  forever. The mobile app shipped this wrapper first; the web showed the
  same infinite "Loading replies…" the day a public relay went down.
  Partial results beat no results.
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
  // Fetch all kind:3 events for the user across relays and pick the newest.
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
  limit = 40
): Promise<FeedNote[]> {
  if (authors.length === 0) return [];
  const filter: NDKFilter = { kinds: [1 as NDKKind], authors, limit };
  const events = await fetchEventsWithTimeout(ndk, filter);
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

export async function publishNote(ndk: NDK, content: string): Promise<string> {
  const ev = new NDKEvent(ndk);
  ev.kind = 1;
  ev.content = content;
  await ev.publish();
  return ev.id;
}

/*
  Engagement (issue #13) — replies, reposts, reactions, zaps for a set of
  notes, in ONE batched subscription filtered by #e. Counts are inherently
  approximate: they only reflect the relays we're connected to.
*/
export type NoteEngagement = {
  replies: number;
  reposts: number;
  reactions: number;
  zaps: number;
  zapSats: number;
};

const blankEngagement = (): NoteEngagement => ({
  replies: 0,
  reposts: 0,
  reactions: 0,
  zaps: 0,
  zapSats: 0,
});

/** Amount encoded in a bolt11 invoice's human-readable part, in sats. */
function bolt11AmountSats(pr: string): number {
  const m = /^ln(?:bc|tb|bcrt)(\d+)([munp])?1/.exec(pr.toLowerCase());
  if (!m) return 0;
  const mult = { m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12 }[m[2] as 'm' | 'u' | 'n' | 'p'] ?? 1;
  return Math.round(Number(m[1]) * mult * 1e8);
}

export async function fetchEngagement(
  ndk: NDK,
  noteIds: string[]
): Promise<Record<string, NoteEngagement>> {
  if (noteIds.length === 0) return {};
  const filter: NDKFilter = {
    kinds: [1, 6, 7, 9735] as NDKKind[],
    '#e': noteIds,
  };
  const events = await fetchEventsWithTimeout(ndk, filter);
  const idSet = new Set(noteIds);
  const seen = new Set<string>();
  const map: Record<string, NoteEngagement> = {};
  for (const ev of events) {
    if (seen.has(ev.id)) continue; // de-dupe across relays
    seen.add(ev.id);
    // One event can reference several of our notes; credit each once.
    const refs = new Set(
      ev.tags.filter((t) => t[0] === 'e' && idSet.has(t[1])).map((t) => t[1])
    );
    for (const id of refs) {
      const e = (map[id] ??= blankEngagement());
      if (ev.kind === 1) e.replies += 1;
      else if (ev.kind === 6) e.reposts += 1;
      else if (ev.kind === 7) e.reactions += 1;
      else if (ev.kind === 9735) {
        e.zaps += 1;
        const bolt11 = ev.tags.find((t) => t[0] === 'bolt11')?.[1];
        if (bolt11) e.zapSats += bolt11AmountSats(bolt11);
      }
    }
  }
  return map;
}

/*
  Profile page data: the notes a user liked (kind:7) or reposted (kind:6),
  newest engagement first. Two round-trips: the user's marks, then the
  referenced notes by id.
*/
export async function fetchEngagedNotes(
  ndk: NDK,
  pubkey: string,
  kind: 6 | 7,
  limit = 30
): Promise<FeedNote[]> {
  const marks = await fetchEventsWithTimeout(ndk, {
    kinds: [kind as NDKKind],
    authors: [pubkey],
    limit: limit * 2,
  });
  const orderedIds: string[] = [];
  const seen = new Set<string>();
  for (const ev of Array.from(marks).sort((a, b) => (b.created_at || 0) - (a.created_at || 0))) {
    for (const t of ev.tags) {
      if (t[0] === 'e' && t[1]?.length === 64 && !seen.has(t[1])) {
        seen.add(t[1]);
        orderedIds.push(t[1]);
      }
    }
  }
  const ids = orderedIds.slice(0, limit);
  if (ids.length === 0) return [];
  const events = await fetchEventsWithTimeout(ndk, { ids });
  const byId = new Map<string, NDKEvent>();
  for (const ev of events) byId.set(ev.id, ev);
  return ids
    .map((id) => byId.get(id))
    .filter((ev): ev is NDKEvent => !!ev)
    .map((ev) => ({
      id: ev.id,
      pubkey: ev.pubkey,
      content: ev.content,
      createdAt: ev.created_at || 0,
      tags: ev.tags,
    }));
}

/*
  Thread view (issue #14) — replies to one note, oldest first, plus the
  NIP-10-tagged publish helpers for replying and reacting.
*/
export async function fetchReplies(ndk: NDK, noteId: string): Promise<FeedNote[]> {
  const events = await fetchEventsWithTimeout(ndk, { kinds: [1 as NDKKind], '#e': [noteId] });
  const notes: FeedNote[] = [];
  const seen = new Set<string>();
  for (const ev of events) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    notes.push({
      id: ev.id,
      pubkey: ev.pubkey,
      content: ev.content,
      createdAt: ev.created_at || 0,
      tags: ev.tags,
    });
  }
  notes.sort((a, b) => a.createdAt - b.createdAt);
  return notes;
}

export async function publishReply(
  ndk: NDK,
  parent: FeedNote,
  content: string
): Promise<string> {
  const ev = new NDKEvent(ndk);
  ev.kind = 1;
  ev.content = content;
  // NIP-10 marked tags: if the parent is itself a reply, keep its root as
  // our root and mark the parent as the direct reply target.
  const rootTag = parent.tags.find((t) => t[0] === 'e' && t[3] === 'root');
  ev.tags = rootTag
    ? [
        ['e', rootTag[1], '', 'root'],
        ['e', parent.id, '', 'reply'],
      ]
    : [['e', parent.id, '', 'root']];
  // Notify the parent author plus everyone already tagged upstream.
  const ps = new Set<string>([parent.pubkey]);
  for (const t of parent.tags) if (t[0] === 'p' && t[1]?.length === 64) ps.add(t[1]);
  for (const p of ps) ev.tags.push(['p', p]);
  await ev.publish();
  return ev.id;
}

export async function publishReaction(ndk: NDK, note: FeedNote): Promise<string> {
  const ev = new NDKEvent(ndk);
  ev.kind = 7;
  ev.content = '+';
  ev.tags = [
    ['e', note.id],
    ['p', note.pubkey],
  ];
  await ev.publish();
  return ev.id;
}

/*
  "Did I already engage with this note?" — one query for the viewer's own
  kind:6/7 events so Like/Repost state survives closing and reopening a
  thread (relays are the source of truth; a local cache smooths slow ones).
*/
export async function fetchMyEngagement(
  ndk: NDK,
  pubkey: string,
  noteId: string
): Promise<{ liked: boolean; reposted: boolean }> {
  const events = await fetchEventsWithTimeout(
    ndk,
    { kinds: [6, 7] as NDKKind[], authors: [pubkey], '#e': [noteId] },
    5000
  );
  let liked = false;
  let reposted = false;
  for (const ev of events) {
    if (ev.kind === 7) liked = true;
    else if (ev.kind === 6) reposted = true;
  }
  return { liked, reposted };
}

export async function publishRepost(ndk: NDK, note: FeedNote): Promise<string> {
  const ev = new NDKEvent(ndk);
  ev.kind = 6;
  ev.content = '';
  ev.tags = [
    ['e', note.id],
    ['p', note.pubkey],
  ];
  await ev.publish();
  return ev.id;
}

/*
  kind:0 profile publish. kind:0 is replaceable — publishing a partial
  object would WIPE fields we don't manage (banner, nip05, …), so merge
  the updates into the latest metadata on the relays first.
*/
export async function publishProfile(
  ndk: NDK,
  pubkey: string,
  updates: { name?: string; about?: string; picture?: string; lud16?: string }
): Promise<NostrProfile> {
  let existing: Record<string, unknown> = {};
  try {
    const events = await fetchEventsWithTimeout(ndk, {
      kinds: [0 as NDKKind],
      authors: [pubkey],
    });
    const latest = Array.from(events).sort(
      (a, b) => (b.created_at || 0) - (a.created_at || 0)
    )[0];
    if (latest) existing = JSON.parse(latest.content) as Record<string, unknown>;
  } catch {}
  const merged = { ...existing } as Record<string, unknown>;
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) continue;
    if (v === '') delete merged[k];
    else merged[k] = v;
  }
  // Keep display_name in sync for clients that read it instead of name.
  if (updates.name !== undefined) {
    if (updates.name === '') delete merged.display_name;
    else merged.display_name = updates.name;
  }
  const ev = new NDKEvent(ndk);
  ev.kind = 0;
  ev.content = JSON.stringify(merged);
  await ev.publish();
  return {
    npub: hexToNpub(pubkey),
    pubkey,
    name: (merged.name as string) || undefined,
    displayName: (merged.display_name as string) || undefined,
    picture: (merged.picture as string) || undefined,
    nip05: (merged.nip05 as string) || undefined,
    lud16: (merged.lud16 as string) || undefined,
    about: (merged.about as string) || undefined,
  };
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
