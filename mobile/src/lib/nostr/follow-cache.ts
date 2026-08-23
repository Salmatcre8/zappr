/*
  Local-first cache of the user's contact list (kind:3) — direct port of the
  web app's follow-cache (see web src/lib/nostr/follow-cache.ts for the "why":
  relays are slow and inconsistent, so local cache is the immediate source of
  truth and relays reconcile in the background).

  Storage: AsyncStorage. Follows are public data — they don't belong in the
  secure vault, and SecureStore has per-item size limits a long contact list
  would blow through.
*/
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'zappr:follows:';

export type FollowsBlob = {
  follows: string[];
  /** unix seconds — when we last cached this list (local clock). */
  updatedAt: number;
  /** created_at of the kind:3 event this came from, if known. */
  eventCreatedAt?: number;
};

export async function saveFollows(
  pubkey: string,
  follows: string[],
  eventCreatedAt?: number
): Promise<void> {
  try {
    const blob: FollowsBlob = {
      follows,
      updatedAt: Math.floor(Date.now() / 1000),
      eventCreatedAt,
    };
    await AsyncStorage.setItem(PREFIX + pubkey, JSON.stringify(blob));
  } catch {}
}

export async function loadFollows(pubkey: string): Promise<FollowsBlob | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + pubkey);
    if (!raw) return null;
    return JSON.parse(raw) as FollowsBlob;
  } catch {
    return null;
  }
}

export async function clearFollows(pubkey: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + pubkey);
  } catch {}
}
