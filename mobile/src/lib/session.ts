/*
  Identity session flows. v1 identity = paste an nsec (same as web's nsec
  path). Seedless passkey onboarding lands with the #6 PRF spike.
*/
import { derivePubkeyFromNsec } from '@/lib/nostr/keys';
import { initNDK } from '@/lib/nostr/ndk';
import { fetchProfile } from '@/lib/nostr/events';
import { clearSession, getSecret, saveSecret, VAULT_KEYS } from '@/lib/vault';
import { useNostrStore } from '@/store/useNostrStore';
import { useAgentStore } from '@/store/useAgentStore';

export async function loginWithNsec(nsec: string): Promise<void> {
  const { hex, npub } = derivePubkeyFromNsec(nsec); // throws on invalid input
  await saveSecret(VAULT_KEYS.nsec, nsec.trim());
  const ndk = await initNDK({ nsec: nsec.trim() });
  const store = useNostrStore.getState();
  store.setNdk(ndk);
  store.setIdentity(hex, npub);
  // Profile is cosmetic — fill it in when the relays answer.
  fetchProfile(ndk, hex).then((p) => {
    if (p) useNostrStore.getState().setIdentity(hex, npub, p);
  });
}

/** Biometric-gated restore of a previously saved nsec. */
export async function unlockSavedIdentity(): Promise<boolean> {
  const nsec = await getSecret(VAULT_KEYS.nsec, { gate: 'Unlock your zappr identity' });
  if (!nsec) return false;
  const { hex, npub } = derivePubkeyFromNsec(nsec);
  const ndk = await initNDK({ nsec });
  const store = useNostrStore.getState();
  store.setNdk(ndk);
  store.setIdentity(hex, npub);
  fetchProfile(ndk, hex).then((p) => {
    if (p) useNostrStore.getState().setIdentity(hex, npub, p);
  });
  return true;
}

/*
  Mode-aware logout (see vault.ts header): drop the signing identity and
  chat state, KEEP wallet-reconnect references and the wallet connection.
*/
export async function logout(): Promise<void> {
  await clearSession();
  useNostrStore.getState().reset();
  useAgentStore.getState().reset();
}
