/*
  Cross-device app data over NIP-78 (APK feedback, issue 2).

  A tester logged in with the same nsec on a second device and was asked for
  the NWC string again — it lived only in that first device's keystore. NWC
  connection strings are the one piece of wallet state that isn't derivable
  from the passkey, so it has to travel with the identity.

  NIP-78 (kind 30078, parameterised-replaceable, keyed by a `d` tag) is the
  Nostr-native place for that: no server, and the relays already hold the
  user's other state. The connection string is a bearer credential — it can
  spend — so the content is NIP-44 encrypted to the user's OWN key. Relays
  store ciphertext; only this identity can read it back.

  Replaceable means each publish supersedes the last, so there is exactly one
  current record per identity rather than an append-only trail.
*/
import NDK, { NDKEvent, NDKRelaySet } from '@nostr-dev-kit/ndk';
import { nip19, nip44 } from 'nostr-tools';

import { DEFAULT_RELAYS } from './ndk';

/** `d` tag identifying this record. Namespaced so it can't collide. */
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

/**
 * Publish the NWC connection string so other devices on this identity can
 * pick it up. Best-effort: a relay failure must never break a working local
 * wallet connection, so callers can ignore the result.
 */
export async function publishNwc(
  ndk: NDK,
  nsec: string,
  pubkey: string,
  nwcUrl: string
): Promise<void> {
  const ev = new NDKEvent(ndk);
  ev.kind = APP_DATA_KIND;
  ev.tags = [['d', NWC_D_TAG]];
  ev.content = nip44.encrypt(JSON.stringify({ nwc: nwcUrl }), selfKey(nsec, pubkey));
  await ev.publish(appRelays(ndk));
}

/**
 * Fetch this identity's stored NWC string, or null when there is none (or it
 * cannot be decrypted — e.g. written by a different key).
 */
export async function fetchNwc(ndk: NDK, nsec: string, pubkey: string): Promise<string | null> {
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
