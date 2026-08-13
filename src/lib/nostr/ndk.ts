import NDK, { NDKPrivateKeySigner, NDKNip07Signer } from '@nostr-dev-kit/ndk';

export const DEFAULT_RELAYS = (
  process.env.NEXT_PUBLIC_DEFAULT_RELAYS ||
  // relay.nostr.band + relay.yakihonne.com went dark Aug 2026 — replaced
  // with long-lived free relays so reads don't burn timeout budget.
  'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://offchain.pub,wss://nostr.oxtr.dev'
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
