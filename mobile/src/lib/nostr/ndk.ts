import NDK, { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

/*
  Same default relay set as the web app (see web .env.local.example).
  No NIP-07 path on native — browser extensions don't exist here; identity
  comes from the vault (nsec) or, later, the #6 passkey-derivation spike.
*/
export const DEFAULT_RELAYS = (
  process.env.EXPO_PUBLIC_DEFAULT_RELAYS ||
  // relay.nostr.band + relay.yakihonne.com went dark Aug 2026 — replaced
  // with long-lived free relays so reads don't burn timeout budget.
  'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://offchain.pub,wss://nostr.oxtr.dev'
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
