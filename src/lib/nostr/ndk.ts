import NDK, { NDKPrivateKeySigner, NDKNip07Signer } from '@nostr-dev-kit/ndk';

export const DEFAULT_RELAYS = (
  process.env.NEXT_PUBLIC_DEFAULT_RELAYS ||
  'wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol,wss://relay.primal.net,wss://relay.yakihonne.com'
).split(',').map((r) => r.trim()).filter(Boolean);

let ndkInstance: NDK | null = null;

export async function initNDK(opts: { nsec?: string; useNip07?: boolean }): Promise<NDK> {
  let signer;
  if (opts.useNip07) {
    signer = new NDKNip07Signer();
  } else if (opts.nsec) {
    signer = new NDKPrivateKeySigner(opts.nsec);
  }
  const ndk = new NDK({ explicitRelayUrls: DEFAULT_RELAYS, signer });
  await ndk.connect(4000).catch(() => {});
  ndkInstance = ndk;
  return ndk;
}

export function getNDK(): NDK | null {
  return ndkInstance;
}
