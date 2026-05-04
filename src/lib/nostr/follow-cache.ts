/*
  Local cache of the user's contact list (kind:3) — keyed by pubkey.

  Why we cache: relays are slow and inconsistent. After a fresh follow,
  the relay we published to may have the new kind:3 but the relay we
  fetch from on next page load may not, leading to "you follow no one"
  flicker. Local cache gives us an immediate source of truth; we still
  reconcile against relays in the background to pick up follows added
  from other Nostr clients.

  Storage: localStorage (per-origin, persists across reloads, no auth).
*/

const PREFIX = 'zappr:follows:';

export type FollowsBlob = {
  follows: string[];
  /** unix seconds — when we last cached this list (local clock). */
  updatedAt: number;
  /** created_at of the kind:3 event this came from, if known. */
  eventCreatedAt?: number;
};

export function saveFollows(
  pubkey: string,
  follows: string[],
  eventCreatedAt?: number
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const blob: FollowsBlob = {
      follows,
      updatedAt: Math.floor(Date.now() / 1000),
      eventCreatedAt,
    };
    localStorage.setItem(PREFIX + pubkey, JSON.stringify(blob));
  } catch {}
}

export function loadFollows(pubkey: string): FollowsBlob | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PREFIX + pubkey);
    if (!raw) return null;
    return JSON.parse(raw) as FollowsBlob;
  } catch {
    return null;
  }
}

export function clearFollows(pubkey: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(PREFIX + pubkey);
  } catch {}
}
