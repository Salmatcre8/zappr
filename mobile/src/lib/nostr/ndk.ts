import NDK, { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

/*
  Same default relay set as the web app (see web .env.local.example).
  No NIP-07 path on native — browser extensions don't exist here; identity
  comes from the vault (nsec) or, later, the #6 passkey-derivation spike.
*/
export const DEFAULT_RELAYS = (
  process.env.EXPO_PUBLIC_DEFAULT_RELAYS ||
  'wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol,wss://relay.primal.net,wss://relay.yakihonne.com'
).split(',').map((r: string) => r.trim()).filter(Boolean);

let ndkInstance: NDK | null = null;

export async function initNDK(opts: { nsec?: string } = {}): Promise<NDK> {
  const signer = opts.nsec ? new NDKPrivateKeySigner(opts.nsec) : undefined;
  const ndk = new NDK({ explicitRelayUrls: DEFAULT_RELAYS, signer });
  await ndk.connect(4000).catch(() => {});
  ndkInstance = ndk;
  return ndk;
}

export function getNDK(): NDK | null {
  return ndkInstance;
}
