import { nip19, getPublicKey } from 'nostr-tools';

export function nsecToHex(nsec: string): string {
  const decoded = nip19.decode(nsec.trim());
  if (decoded.type !== 'nsec') throw new Error('Invalid nsec');
  const data = decoded.data as Uint8Array;
  return Array.from(data).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToNpub(hex: string): string {
  return nip19.npubEncode(hex);
}

export function npubToHex(npub: string): string {
  const decoded = nip19.decode(npub.trim());
  if (decoded.type !== 'npub') throw new Error('Invalid npub');
  return decoded.data as string;
}

export function derivePubkeyFromNsec(nsec: string): { hex: string; npub: string } {
  const decoded = nip19.decode(nsec.trim());
  if (decoded.type !== 'nsec') throw new Error('Invalid nsec');
  const sk = decoded.data as Uint8Array;
  const hex = getPublicKey(sk);
  return { hex, npub: nip19.npubEncode(hex) };
}

export function truncateNpub(npub: string, size = 8): string {
  if (npub.length <= size * 2 + 3) return npub;
  return `${npub.slice(0, size)}…${npub.slice(-size)}`;
}
