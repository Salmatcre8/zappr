/*
  WebAuthn PRF wrappers for the zappr biometric vault.

  Two modes are supported by the vault layer (see vault.ts):

    'encrypted' — legacy. enrollVault({nsec,nwc}) creates a passkey, evaluates
                  PRF, encrypts the payload, persists. unlockVault() decrypts.
                  Used when an existing nsec user opts into biometric refresh.

    'derived'   — new. enrollDerivedVault(credentialId) stores only the
                  credential id. The nsec + Liquid mnemonic are re-derived from
                  PRF outputs on every unlock — see passkey-derive.ts.

  PRF support: Chrome 116+ (full PRF), Firefox 148+, Safari 18+ (iOS 18+).
*/

import {
  vaultGet,
  vaultPut,
  type EncryptedVaultBlob,
  type DerivedVaultBlob,
} from './vault';
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

// ---- Encrypted mode (existing nsec users) ----

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
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
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

  const blob: EncryptedVaultBlob = {
    kind: 'encrypted',
    credentialId: new Uint8Array(created.rawId),
    ciphertext,
    iv,
    salt,
  };
  await vaultPut(blob);
}

export async function unlockVault(): Promise<PrfPlaintext> {
  if (!isWebAuthnSupported()) throw new Error('WebAuthn unavailable');
  const stored = await vaultGet();
  if (!stored) throw new Error('No vault enrolled');
  if (stored.kind !== 'encrypted') {
    throw new Error('Vault is in derived mode — use unlockDerivedVault');
  }

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32) as any,
      allowCredentials: [{ id: stored.credentialId as any, type: 'public-key' }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: stored.salt as any } } },
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error('Biometric cancelled');

  const ext = assertion.getClientExtensionResults() as PrfExtensionResults;
  const prfOutput = ext.prf?.results?.first;
  if (!prfOutput) {
    throw new Error('PRF unlock failed — authenticator did not return key material');
  }

  const key = await deriveAesKey(prfOutput);
  const plaintextBytes = await aesDecrypt(key, stored.ciphertext, stored.iv);
  const parsed = JSON.parse(utf8Decode(plaintextBytes)) as PrfPlaintext;
  if (!parsed.nsec) throw new Error('Vault payload corrupt');
  return parsed;
}

// ---- Derived mode (seedless passkey wallet) ----

/**
 * Persist a derived-mode vault. Stores only the credential id — the nsec and
 * Liquid mnemonic are re-derived from PRF outputs on every unlock.
 */
export async function enrollDerivedVault(credentialId: Uint8Array): Promise<void> {
  const blob: DerivedVaultBlob = { kind: 'derived', credentialId };
  await vaultPut(blob);
}
