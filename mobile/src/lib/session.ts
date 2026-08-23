/*
  Identity session flows — mirrors the web app's model (web src/lib/auth/session.ts):

  - nsec login saves a session marker so a cold start restores SILENTLY,
    no re-prompt (web uses sessionStorage the same way for refresh-safety).
    The nsec itself lives only in the device keystore; the marker is just
    "a session exists".
  - "Unlock with biometric" is the explicit, gated path after a logout.
  - The saved NWC wallet reconnects in the background on restore, like the
    web's hydrateNwc-on-refresh.
  - Seedless passkey onboarding (web's "Start fresh") lands with the #6
    PRF spike + dev build.
*/
import AsyncStorage from '@react-native-async-storage/async-storage';

import { derivePubkeyFromNsec } from '@/lib/nostr/keys';
import { initNDK } from '@/lib/nostr/ndk';
import { fetchProfile } from '@/lib/nostr/events';
import { loadOwnProfile, saveOwnProfile } from '@/lib/nostr/profile-cache';
import { NwcAdapter } from '@/lib/wallet/nwcAdapter';
import { clearSession, getSecret, saveSecret, VAULT_KEYS } from '@/lib/vault';
import { useNostrStore } from '@/store/useNostrStore';
import { useAgentStore } from '@/store/useAgentStore';
import { useWalletStore } from '@/store/useWalletStore';

const SESSION_FLAG = 'zappr:session';

async function activate(nsec: string): Promise<void> {
  const { hex, npub } = derivePubkeyFromNsec(nsec); // throws on invalid input
  const ndk = await initNDK({ nsec });
  const store = useNostrStore.getState();
  store.setNdk(ndk);
  store.setIdentity(hex, npub);
  // Own profile: the local cache answers instantly (never "anon" on a cold
  // start), then the relays reconcile — with retries, because a single
  // attempt right after connect races the websocket handshakes.
  loadOwnProfile(hex).then((cached) => {
    if (cached && !useNostrStore.getState().profile) {
      useNostrStore.getState().setIdentity(hex, npub, cached);
    }
  });
  (async () => {
    for (const delay of [0, 5000, 15000]) {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      const p = await fetchProfile(ndk, hex).catch(() => null);
      if (p && (p.name || p.displayName || p.picture || p.lud16 || p.about)) {
        useNostrStore.getState().setIdentity(hex, npub, p);
        await saveOwnProfile(p);
        return;
      }
    }
  })().catch(() => {});
}

/*
  A second device on the same identity has no NWC string in its keystore —
  it was only ever saved on the first phone. Ask the relays for the NIP-78
  record before concluding there is no wallet (APK feedback, issue 2).
*/
async function recoverNwcFromRelays(): Promise<string | null> {
  const { ndk, pubkey } = useNostrStore.getState();
  if (!ndk || !pubkey) return null;
  const nsec = await getSecret(VAULT_KEYS.nsec);
  if (!nsec) return null;
  const { fetchNwc } = await import('@/lib/nostr/app-data');
  const url = await fetchNwc(ndk, nsec, pubkey).catch(() => null);
  if (url) await saveSecret(VAULT_KEYS.nwcUrl, url);
  return url;
}

/**
 * Persist an NWC connection both on this device and — encrypted to the user's
 * own key — on the relays, so the next device inherits it. Relay failure is
 * non-fatal: the local wallet still works.
 */
export async function rememberNwc(url: string): Promise<void> {
  await saveSecret(VAULT_KEYS.nwcUrl, url);
  const { ndk, pubkey } = useNostrStore.getState();
  if (!ndk || !pubkey) return;
  const nsec = await getSecret(VAULT_KEYS.nsec);
  if (!nsec) return;
  try {
    const { publishNwc } = await import('@/lib/nostr/app-data');
    await publishNwc(ndk, nsec, pubkey, url);
  } catch {
    // Offline or every relay rejected it — try again next time it connects.
  }
}

/*
  Background wallet reconnect — never blocks launch, failure is silent.
  Prefers the self-custodial Spark wallet (vaulted mnemonic) like web's
  hydrateBreez; falls back to a saved NWC connection.
*/
function hydrateSavedWallet(): void {
  (async () => {
    if (useWalletStore.getState().adapter) return;
    const mnemonic = await getSecret(VAULT_KEYS.breezMnemonic);
    if (mnemonic) {
      try {
        const { SparkAdapter, sparkConfigured } = await import('@/lib/wallet/sparkAdapter');
        if (sparkConfigured) {
          const adapter = await SparkAdapter.connect(mnemonic);
          useWalletStore.getState().setAdapter(adapter);
          try {
            useWalletStore.getState().setBalance(await adapter.getBalance());
          } catch {}
          return;
        }
      } catch {
        // Spark needs the dev build + API key; fall through to NWC.
      }
    }
    const url = (await getSecret(VAULT_KEYS.nwcUrl)) ?? (await recoverNwcFromRelays());
    if (!url || useWalletStore.getState().adapter) return;
    const adapter = await NwcAdapter.connect(url);
    useWalletStore.getState().setAdapter(adapter, { connectionString: url });
    try {
      useWalletStore.getState().setBalance(await adapter.getBalance());
    } catch {}
  })().catch(() => {});
}

export async function loginWithNsec(nsec: string, nwc?: string): Promise<void> {
  const trimmed = nsec.trim();
  await activate(trimmed);
  await saveSecret(VAULT_KEYS.nsec, trimmed);
  await AsyncStorage.setItem(SESSION_FLAG, JSON.stringify({ method: 'nsec' }));
  if (nwc?.trim()) {
    const url = nwc.trim();
    try {
      const adapter = await NwcAdapter.connect(url);
      useWalletStore.getState().setAdapter(adapter, { connectionString: url });
      await rememberNwc(url);
    } catch {
      // Identity login succeeded; a bad NWC string shouldn't block it.
    }
  } else {
    hydrateSavedWallet();
  }
}

/**
 * Seedless passkey login (issue #6, web's "Create with FaceID / Fingerprint"):
 * one passkey + PRF → deterministic nsec + wallet mnemonic, nothing to write
 * down. Requires the dev build (native passkeys) and the domain association.
 */
export async function loginWithPasskey(create: boolean): Promise<void> {
  const { createPasskeyNative, discoverPasskeyNative } = await import('@/lib/auth/native-passkey');
  const { deriveNsecFromPrf, deriveMnemonicFromPrf } = await import('@/lib/auth/derive');
  const out = create
    ? await createPasskeyNative('zappr account')
    : await discoverPasskeyNative();
  const { nsec } = deriveNsecFromPrf(out.nostrPrf);
  const mnemonic = deriveMnemonicFromPrf(out.liquidPrf);
  await activate(nsec);
  await saveSecret(VAULT_KEYS.nsec, nsec);
  // The same PRF-derived mnemonic seeds the Spark wallet (and previously the
  // Liquid one) — vaulted here so Backup can show it and the wallet can init.
  await saveSecret(VAULT_KEYS.breezMnemonic, mnemonic);
  await AsyncStorage.setItem(SESSION_FLAG, JSON.stringify({ method: 'passkey' }));
  hydrateSavedWallet();
}

/** Biometric-gated unlock of a saved identity (explicit path after logout). */
export async function unlockSavedIdentity(): Promise<boolean> {
  const nsec = await getSecret(VAULT_KEYS.nsec, { gate: 'Unlock your zappr identity' });
  if (!nsec) return false;
  await activate(nsec);
  await AsyncStorage.setItem(SESSION_FLAG, JSON.stringify({ method: 'nsec' }));
  hydrateSavedWallet();
  return true;
}

/**
 * Silent cold-start restore (web refresh-safety parity): only runs when a
 * session marker exists, i.e. the user logged in and did not log out.
 */
export async function restoreSession(): Promise<boolean> {
  try {
    const flag = await AsyncStorage.getItem(SESSION_FLAG);
    if (!flag) return false;
    const nsec = await getSecret(VAULT_KEYS.nsec);
    if (!nsec) return false;
    await activate(nsec);
    hydrateSavedWallet();
    return true;
  } catch {
    return false;
  }
}

/*
  Mode-aware logout (see vault.ts header): drop the signing identity, the
  session marker, and chat state — KEEP wallet-reconnect references.
*/
export async function logout(): Promise<void> {
  await clearSession();
  try {
    await AsyncStorage.removeItem(SESSION_FLAG);
  } catch {}
  useNostrStore.getState().reset();
  useAgentStore.getState().reset();
}
