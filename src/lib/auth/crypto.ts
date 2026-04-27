/*
  AES-GCM encrypt/decrypt + HKDF key derivation from a WebAuthn PRF output.

  Why HKDF: the PRF extension returns 32 bytes of raw secret material per
  authenticator + salt pair. We don't want to use that directly as an AES key —
  HKDF lets us mix in an info string ("zappr-vault-v1") so future versions can
  rotate the derivation without breaking existing vaults.
*/

const HKDF_INFO = new TextEncoder().encode('zappr-vault-v1');

export async function deriveAesKey(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    prfOutput,
    'HKDF',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: HKDF_INFO,
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function aesEncrypt(
  key: CryptoKey,
  plaintext: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { ciphertext: new Uint8Array(ct), iv };
}

export async function aesDecrypt(
  key: CryptoKey,
  ciphertext: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new Uint8Array(pt);
}

export function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function utf8Decode(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}
