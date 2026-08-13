/*
  Local copy of the user's OWN kind:0 profile. Relays are the source of
  truth for everyone else's metadata, but for the viewer's own profile a
  cold start should never show "anon" just because a relay was slow —
  we wrote the data, we can remember it.
*/
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NostrProfile } from '@/types/nostr';

const KEY = 'zappr:me';

export async function loadOwnProfile(pubkey: string): Promise<NostrProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as NostrProfile;
    return p.pubkey === pubkey ? p : null;
  } catch {
    return null;
  }
}

export async function saveOwnProfile(p: NostrProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}
