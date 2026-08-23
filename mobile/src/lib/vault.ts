/*
  Native secure vault (issue #10) — replaces the web app's AES-256-GCM
  IndexedDB vault with the platform keystore. The OS gives us hardware-backed
  storage, so we don't hand-roll encryption here.

  Design notes:
  - Secrets live in expo-secure-store (iOS Keychain / Android Keystore),
    device-only (never synced to cloud backups).
  - Reads of key material are gated behind a biometric prompt via
    expo-local-authentication. On devices with no biometrics enrolled
    (emulators, some low-end phones) the gate passes through rather than
    locking the user out — the OS keystore is still the storage boundary.
    Dev builds can additionally flip `requireAuthentication: true` per item
    (unsupported in Expo Go, and keys are invalidated if biometrics change).
  - MODE-AWARE LOGOUT: `clearSession()` removes the signing key but keeps the
    wallet-reconnect references (NWC url / mnemonic). Wiping those on logout
    is exactly the lockout bug web hit once (web commit 3307703) — a returning
    user must be able to reconnect the same wallet. `wipeAll()` is the
    explicit, destructive "remove everything from this device".
*/
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

/** Namespaced keys so nothing collides with other keychain entries. */
export const VAULT_KEYS = {
  /** Nostr secret key (nsec, bech32) — the session's signing identity. */
  nsec: 'zappr.nsec',
  /** NWC connection string — reference that lets a user reconnect their wallet. */
  nwcUrl: 'zappr.nwc_url',
  /** Breez wallet mnemonic (future — #6/#7). Reconnect reference, NOT session. */
  breezMnemonic: 'zappr.breez_mnemonic',
} as const;

export type VaultKey = (typeof VAULT_KEYS)[keyof typeof VAULT_KEYS];

const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * Biometric gate. Resolves true when the user passes Face ID / fingerprint,
 * or when the device has no biometrics to ask for (pass-through, see header).
 */
export async function biometricGate(reason: string): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
    if (!hasHardware || !enrolled) return true;
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
    });
    return res.success;
  } catch {
    return false;
  }
}

export async function saveSecret(key: VaultKey, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, SECURE_OPTS);
}

/**
 * Read a secret. Key material (nsec, mnemonic) is biometric-gated; pass the
 * prompt text via `gate`. Returns null when missing or when the gate fails.
 */
export async function getSecret(
  key: VaultKey,
  opts: { gate?: string } = {}
): Promise<string | null> {
  if (opts.gate) {
    const ok = await biometricGate(opts.gate);
    if (!ok) return null;
  }
  try {
    return await SecureStore.getItemAsync(key, SECURE_OPTS);
  } catch {
    return null;
  }
}

export async function hasSecret(key: VaultKey): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(key, SECURE_OPTS)) !== null;
  } catch {
    return false;
  }
}

async function deleteQuietly(key: VaultKey): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key, SECURE_OPTS);
  } catch {}
}

/**
 * Mode-aware logout: end the session (signing key) but KEEP the references
 * that let a returning user reconnect their wallet. See header.
 */
export async function clearSession(): Promise<void> {
  await deleteQuietly(VAULT_KEYS.nsec);
}

/** Explicit destructive wipe — removes every zappr secret from this device. */
export async function wipeAll(): Promise<void> {
  await Promise.all([
    deleteQuietly(VAULT_KEYS.nsec),
    deleteQuietly(VAULT_KEYS.nwcUrl),
    deleteQuietly(VAULT_KEYS.breezMnemonic),
  ]);
}
