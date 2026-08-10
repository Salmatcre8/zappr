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
  // Profile is cosmetic — fill it in when the relays answer.
  fetchProfile(ndk, hex).then((p) => {
    if (p) useNostrStore.getState().setIdentity(hex, npub, p);
  });
}

/*
  Background wallet reconnect — never blocks launch, failure is silent.
  Prefers the self-custodial Breez wallet (vaulted mnemonic) like web's
  hydrateBreez; falls back to a saved NWC connection.
*/
function hydrateSavedWallet(): void {
  (async () => {
    if (useWalletStore.getState().adapter) return;
    const mnemonic = await getSecret(VAULT_KEYS.breezMnemonic);
    if (mnemonic) {
      try {
        const { BreezAdapter, breezConfigured } = await import('@/lib/wallet/breezAdapter');
        if (breezConfigured) {
          const adapter = await BreezAdapter.connect(mnemonic);
          useWalletStore.getState().setAdapter(adapter);
          try {
            useWalletStore.getState().setBalance(await adapter.getBalance());
          } catch {}
          return;
        }
      } catch {
        // Breez needs the dev build + API key; fall through to NWC.
      }
    }
    const url = await getSecret(VAULT_KEYS.nwcUrl);
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
      await saveSecret(VAULT_KEYS.nwcUrl, url);
    } catch {
      // Identity login succeeded; a bad NWC string shouldn't block it.
    }
  } else {
    hydrateSavedWallet();
  }
}

/**
 * Seedless passkey login (issue #6, web's "Create with FaceID / Fingerprint"):
 * one passkey + PRF → deterministic nsec + Liquid mnemonic, nothing to write
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
  // Wallet mnemonic waits for the Breez native SDK (#7) but is derived and
  // vaulted now so Backup can show it and the wallet can init later.
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
