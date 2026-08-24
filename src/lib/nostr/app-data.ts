/*
  Cross-device app data over NIP-78 — web half of the APK feedback (issue 2).

  A tester connected a wallet on their laptop, logged in on their phone with
  the same identity, and was asked for the NWC string all over again. Every
  other piece of state is either derivable from the passkey or already on the
  relays; the NWC connection string is the one exception, because it is issued
  by an external wallet.

  NIP-78 (kind 30078, parameterised-replaceable, keyed by a `d` tag) is where
  that belongs. The string is a bearer credential — anyone holding it can
  spend — so the content is NIP-44 encrypted to the user's OWN key and relays
  only ever store ciphertext. Replaceable means one current record per
  identity rather than an append-only trail.

  Kept byte-compatible with the mobile app's src/lib/nostr/app-data.ts: same
  `d` tag, same JSON shape, same NIP-44 v2 envelope, so a record written on
  one platform reads on the other. The only difference is where the nsec comes
  from — mobile passes it in from the keystore, web reads it off the active
  NDK signer, because there is no single place the web app keeps it.
*/
import NDK, { NDKEvent, NDKRelaySet } from '@nostr-dev-kit/ndk';
import { nip19, nip44 } from 'nostr-tools';

import { DEFAULT_RELAYS } from './ndk';

/** `d` tag identifying this record. Must match the mobile app verbatim. */
const NWC_D_TAG = 'zappr:nwc:v1';
const APP_DATA_KIND = 30078;
const FETCH_TIMEOUT_MS = 6000;

function appRelays(ndk: NDK): NDKRelaySet {
  return NDKRelaySet.fromRelayUrls(DEFAULT_RELAYS, ndk);
}

function secretBytes(nsec: string): Uint8Array {
  const decoded = nip19.decode(nsec.trim());
  if (decoded.type !== 'nsec') throw new Error('Not an nsec');
  return decoded.data as Uint8Array;
}

/*
  Encrypting to yourself: the NIP-44 conversation key is symmetric, so
  (my secret, my pubkey) both encrypts and decrypts.
*/
function selfKey(nsec: string, pubkey: string): Uint8Array {
  return nip44.getConversationKey(secretBytes(nsec), pubkey);
}

/*
  The nsec of the logged-in identity, read off the active signer.

  Returns null for NIP-07 logins: the extension holds the key and never hands
  it over, so those sessions cannot encrypt or decrypt this record. Skipping
  them is deliberate — better than half-syncing something we could not read
  back on the other device.
*/
export function nsecFromNdk(ndk: NDK): string | null {
  try {
    const signer = ndk.signer as { nsec?: string } | undefined;
    return typeof signer?.nsec === 'string' && signer.nsec ? signer.nsec : null;
  } catch {
    return null;
  }
}

/**
 * Publish the NWC connection string so the user's other devices inherit it.
 * Best-effort — a relay failure must never break a working local wallet.
 */
export async function publishNwc(ndk: NDK, pubkey: string, nwcUrl: string): Promise<void> {
  const nsec = nsecFromNdk(ndk);
  if (!nsec) return;
  const ev = new NDKEvent(ndk);
  ev.kind = APP_DATA_KIND;
  ev.tags = [['d', NWC_D_TAG]];
  ev.content = nip44.encrypt(JSON.stringify({ nwc: nwcUrl }), selfKey(nsec, pubkey));
  await ev.publish(appRelays(ndk));
}

/**
 * Fetch this identity's stored NWC string, or null when there is none (or it
 * cannot be decrypted — e.g. written under a different key).
 */
export async function fetchNwc(ndk: NDK, pubkey: string): Promise<string | null> {
  const nsec = nsecFromNdk(ndk);
  if (!nsec) return null;

  const event = await new Promise<NDKEvent | null>((resolve) => {
    let latest: NDKEvent | null = null;
    const sub = ndk.subscribe(
      { kinds: [APP_DATA_KIND], authors: [pubkey], '#d': [NWC_D_TAG] },
      { closeOnEose: true, groupable: false },
      appRelays(ndk)
    );
    const finish = () => {
      try {
        sub.stop();
      } catch {}
      resolve(latest);
    };
    // Relays may each hold a different revision; keep the newest.
    sub.on('event', (e: NDKEvent) => {
      if (!latest || (e.created_at ?? 0) > (latest.created_at ?? 0)) latest = e;
    });
    sub.on('eose', finish);
    // Never hang on a stalled relay (same reasoning as fetchEventsWithTimeout).
    setTimeout(finish, FETCH_TIMEOUT_MS);
  });

  if (!event?.content) return null;
  try {
    const plain = nip44.decrypt(event.content, selfKey(nsec, pubkey));
    const parsed = JSON.parse(plain) as { nwc?: unknown };
    return typeof parsed.nwc === 'string' && parsed.nwc ? parsed.nwc : null;
  } catch {
    return null;
  }
}
