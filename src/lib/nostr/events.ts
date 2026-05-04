import NDK, { NDKEvent, NDKFilter, NDKKind, NDKUser } from '@nostr-dev-kit/ndk';
import type { FeedNote, NostrProfile } from '@/types/nostr';
import { hexToNpub } from './keys';

export async function fetchFollowList(ndk: NDK, pubkey: string): Promise<string[]> {
  // Fetch all kind:3 events for the user across relays and pick the newest.
  // Relays can return stale contact lists; taking [0] gives us arbitrary order.
  const filter: NDKFilter = { kinds: [3 as NDKKind], authors: [pubkey] };
  const events = await ndk.fetchEvents(filter);
  const latest = Array.from(events).sort(
    (a, b) => (b.created_at || 0) - (a.created_at || 0)
  )[0];
  if (!latest) return [];
  const pubs = latest.tags
    .filter((t) => t[0] === 'p' && typeof t[1] === 'string' && t[1].length === 64)
    .map((t) => t[1]);
  return Array.from(new Set(pubs));
}

export async function fetchFeed(
  ndk: NDK,
  authors: string[],
  limit = 40
): Promise<FeedNote[]> {
  if (authors.length === 0) return [];
  const filter: NDKFilter = { kinds: [1 as NDKKind], authors, limit };
  const events = await ndk.fetchEvents(filter);
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
    const p = await user.fetchProfile();
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

export async function publishContacts(ndk: NDK, pubkeys: string[]): Promise<string> {
  const ev = new NDKEvent(ndk);
  ev.kind = 3;
  ev.tags = pubkeys.map((p) => ['p', p]);
  ev.content = '';
  await ev.publish();
  return ev.id;
}
