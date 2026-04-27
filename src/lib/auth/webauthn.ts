/*
  WebAuthn PRF extension wrapper for the zappr biometric vault.

  Two operations:
    enrollVault({ nsec, nwc }) — create a passkey, evaluate PRF, encrypt the
                                  payload with an HKDF-derived key, persist to
                                  IndexedDB.
    unlockVault()              — call get() with the stored credential id,
                                  evaluate PRF, decrypt the stored payload.

  PRF support: Chrome 116+, Safari 18+ (iOS 18+). Firefox doesn't implement it
  yet. `isPrfSupported()` lets the UI decide whether to even offer the option.
*/

import { vaultGet, vaultPut, type VaultBlob } from './vault';
import { deriveAesKey, aesEncrypt, aesDecrypt, utf8Encode, utf8Decode } from './crypto';

type PrfPlaintext = {
  nsec: string;
  nwc?: string | null;
};

type PrfExtensionResults = {
  prf?: { results?: { first?: ArrayBuffer } };
};

function randomBytes(len: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(len));
}

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.credentials
  );
}

/**
 * Best-effort check for PRF support. We can't truly know without enrolling,
 * but we can confirm that the platform exposes WebAuthn at all and is in a
 * secure context. The first enrollment will surface PRF errors if missing.
 */
export async function isPrfLikelySupported(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  if (!window.isSecureContext) return false;
  try {
    const available =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
    return available !== false;
  } catch {
    return false;
  }
}

/**
 * Register a new passkey, evaluate PRF, encrypt the payload, persist to vault.
 * Throws if the authenticator doesn't return PRF output.
 */
export async function enrollVault(payload: PrfPlaintext): Promise<void> {
  if (!isWebAuthnSupported()) throw new Error('WebAuthn unavailable');

  const salt = randomBytes(32);
  const userId = randomBytes(16);
  const challenge = randomBytes(32);

  const created = (await navigator.credentials.create({
    publicKey: {
      challenge: challenge as any,
      rp: { name: 'zappr', id: window.location.hostname },
      user: {
        id: userId as any,
        name: 'zappr-vault',
        displayName: 'zappr vault',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
      extensions: { prf: { eval: { first: salt as any } } },
    },
  })) as PublicKeyCredential | null;

  if (!created) throw new Error('Passkey creation cancelled');

  // Some authenticators return PRF output during create(); most require a
  // second get() call. Try create() first, then fall back.
  const createExt = created.getClientExtensionResults() as PrfExtensionResults;
  let prfOutput: ArrayBuffer | undefined = createExt.prf?.results?.first;

  if (!prfOutput) {
    const getResp = (await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32) as any,
        allowCredentials: [{ id: created.rawId as any, type: 'public-key' }],
        userVerification: 'required',
        timeout: 60_000,
        extensions: { prf: { eval: { first: salt as any } } },
      },
    })) as PublicKeyCredential | null;

    if (!getResp) throw new Error('Biometric assertion cancelled');
    const getExt = getResp.getClientExtensionResults() as PrfExtensionResults;
    prfOutput = getExt.prf?.results?.first;
  }

  if (!prfOutput) {
    throw new Error('PRF extension not supported by this authenticator');
  }

  const key = await deriveAesKey(prfOutput);
  const plaintext = utf8Encode(JSON.stringify(payload));
  const { ciphertext, iv } = await aesEncrypt(key, plaintext);

  const blob: VaultBlob = {
    credentialId: new Uint8Array(created.rawId),
    ciphertext,
    iv,
    salt,
  };
  await vaultPut(blob);
}

/**
 * Unlock the vault: call get() against the stored credential id, evaluate PRF,
 * decrypt the payload. Triggers a biometric prompt.
 */
export async function unlockVault(): Promise<PrfPlaintext> {
  if (!isWebAuthnSupported()) throw new Error('WebAuthn unavailable');
  const stored = await vaultGet();
  if (!stored) throw new Error('No vault enrolled');

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32) as any,
      allowCredentials: [
        { id: stored.credentialId as any, type: 'public-key' },
      ],
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: stored.salt as any } } },
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error('Biometric cancelled');

  const ext = assertion.getClientExtensionResults() as PrfExtensionResults;
  const prfOutput = ext.prf?.results?.first;
  if (!prfOutput) throw new Error('PRF unlock failed — authenticator did not return key material');

  const key = await deriveAesKey(prfOutput);
  const plaintextBytes = await aesDecrypt(key, stored.ciphertext, stored.iv);
  const parsed = JSON.parse(utf8Decode(plaintextBytes)) as PrfPlaintext;
  if (!parsed.nsec) throw new Error('Vault payload corrupt');
  return parsed;
}
