/*
  Passkey-derived keys per the Breez passkey-login spec.

  One passkey → two deterministic outputs via the WebAuthn PRF extension:
    1. Nostr nsec   = BIP32(m/44'/1237'/55'/0/0) on PRF(passkey, NOSTR_SALT)
    2. Liquid seed  = BIP39 mnemonic from PRF(passkey, LIQUID_SALT)

  The passkey never leaves the secure enclave. Both keys are reproducible
  every unlock — we never store nsec or mnemonic, only the passkey credentialId.

  Spec: https://github.com/breez/passkey-login/blob/main/spec.md
*/

import { HDKey } from '@scure/bip32';
import { entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { nip19, getPublicKey } from 'nostr-tools';

// "NYOASTRTSAOYN" — the Breez magic constant for Nostr account derivation.
// Hex-encoded so it round-trips cleanly as a salt.
export const NOSTR_SALT = new Uint8Array([
  0x4e, 0x59, 0x4f, 0x41, 0x53, 0x54, 0x52, 0x54, 0x53, 0x41, 0x4f, 0x59, 0x4e,
]);

// App-specific salt for the Liquid wallet seed. Memorable, Nostr-publishable
// per the Breez spec — different app, different salt, same passkey.
export const LIQUID_SALT = new TextEncoder().encode('zappr-liquid-v1');

// BIP-44 derivation path for Nostr (coin index 1237, account 55 per Breez spec).
const NOSTR_PATH = "m/44'/1237'/55'/0/0";

type PrfExtensionResults = {
  prf?: { results?: { first?: ArrayBuffer; second?: ArrayBuffer } };
};

function randomBytes(len: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(len));
}

/**
 * Create a new passkey with PRF enabled, evaluating against both salts in
 * a single ceremony. Returns the credential id + both PRF outputs.
 */
export async function createPasskey(displayName: string): Promise<{
  credentialId: Uint8Array;
  nostrPrf: ArrayBuffer;
  liquidPrf: ArrayBuffer;
}> {
  const userId = randomBytes(16);
  const challenge = randomBytes(32);

  const created = (await navigator.credentials.create({
    publicKey: {
      challenge: challenge as any,
      rp: { name: 'zappr', id: window.location.hostname },
      user: { id: userId as any, name: displayName, displayName },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        userVerification: 'required',
        residentKey: 'required',
      },
      timeout: 60_000,
      extensions: {
        prf: { eval: { first: NOSTR_SALT as any, second: LIQUID_SALT as any } },
      },
    },
  })) as PublicKeyCredential | null;

  if (!created) throw new Error('Passkey creation cancelled');

  const credentialId = new Uint8Array(created.rawId);

  // Some authenticators return PRF on create(), others require a second get().
  let { first, second } = readPrf(created);

  if (!first || !second) {
    const got = await assertPasskey(credentialId);
    first = got.nostrPrf;
    second = got.liquidPrf;
  }

  if (!first || !second) {
    throw new Error('PRF extension not supported by this authenticator');
  }

  return { credentialId, nostrPrf: first, liquidPrf: second };
}

/**
 * Discover a passkey for this origin without knowing its credential id ahead
 * of time — used for "log back in" / recovery when IndexedDB has been cleared
 * (e.g. after a fresh logout, or browser data cleanup). Calls get() with an
 * empty allowCredentials, which prompts the user to select any discoverable
 * passkey for this rp.id. The passkey itself still lives in the device's
 * platform authenticator (iCloud Keychain, Google Password Manager, etc.) —
 * we just rediscover its credential id and re-evaluate PRF.
 */
export async function discoverPasskey(): Promise<{
  credentialId: Uint8Array;
  nostrPrf: ArrayBuffer;
  liquidPrf: ArrayBuffer;
}> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32) as any,
      // Empty allowCredentials → user picks any passkey for this origin.
      allowCredentials: [],
      userVerification: 'required',
      timeout: 60_000,
      extensions: {
        prf: { eval: { first: NOSTR_SALT as any, second: LIQUID_SALT as any } },
      },
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error('Biometric cancelled');

  const credentialId = new Uint8Array(assertion.rawId);
  const { first, second } = readPrf(assertion);
  if (!first || !second) {
    throw new Error('PRF unlock failed — authenticator did not return key material');
  }
  return { credentialId, nostrPrf: first, liquidPrf: second };
}

/**
 * Re-evaluate PRF against an existing passkey. Triggers a biometric prompt.
 */
export async function assertPasskey(credentialId: Uint8Array): Promise<{
  nostrPrf: ArrayBuffer;
  liquidPrf: ArrayBuffer;
}> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32) as any,
      allowCredentials: [{ id: credentialId as any, type: 'public-key' }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: {
        prf: { eval: { first: NOSTR_SALT as any, second: LIQUID_SALT as any } },
      },
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error('Biometric assertion cancelled');

  const { first, second } = readPrf(assertion);
  if (!first || !second) {
    throw new Error('PRF unlock failed — authenticator did not return key material');
  }
  return { nostrPrf: first, liquidPrf: second };
}

function readPrf(cred: PublicKeyCredential): {
  first?: ArrayBuffer;
  second?: ArrayBuffer;
} {
  const ext = cred.getClientExtensionResults() as PrfExtensionResults;
  return {
    first: ext.prf?.results?.first,
    second: ext.prf?.results?.second,
  };
}

/**
 * Derive a Nostr nsec from a 32-byte PRF output via BIP32 m/44'/1237'/55'/0/0.
 * We treat the PRF output as the master seed (Breez spec uses it as the
 * account master directly).
 */
export function deriveNsecFromPrf(prfOutput: ArrayBuffer): {
  nsec: string;
  hex: string;
  npub: string;
} {
  const seed = new Uint8Array(prfOutput);
  const master = HDKey.fromMasterSeed(seed);
  const child = master.derive(NOSTR_PATH);
  if (!child.privateKey) throw new Error('BIP32 derivation produced no private key');

  const nsec = nip19.nsecEncode(child.privateKey);
  const hex = bytesToHex(child.privateKey);
  // Nostr public key is x-only schnorr — use nostr-tools
  const npub = computeNpub(child.privateKey);
  return { nsec, hex, npub };
}

/**
 * Derive a 12-word BIP-39 mnemonic from a 32-byte PRF output. We take the
 * first 16 bytes as entropy (128 bits → 12 words).
 */
export function deriveMnemonicFromPrf(prfOutput: ArrayBuffer): string {
  const bytes = new Uint8Array(prfOutput);
  const entropy = bytes.slice(0, 16);
  return entropyToMnemonic(entropy, wordlist);
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}

function computeNpub(privateKey: Uint8Array): string {
  return nip19.npubEncode(getPublicKey(privateKey));
}
