/*
  Local copy of the user's OWN kind:0 profile. Relays are the source of
  truth for everyone else's metadata, but for the viewer's own profile a
  hard refresh should never show "anon" just because a relay was slow —
  we wrote the data, we can remember it.
*/
import type { NostrProfile } from '@/types/nostr';

const KEY = 'zappr:me';

export function loadOwnProfile(pubkey: string): NostrProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as NostrProfile;
    return p.pubkey === pubkey ? p : null;
  } catch {
    return null;
  }
}

export function saveOwnProfile(p: NostrProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}
