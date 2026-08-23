/*
  Passkey-derived keys — EXACT port of web src/lib/auth/passkey-derive.ts
  (Breez passkey-login spec). Same salts, same paths, same byte handling:
  if native PRF returns the same bytes as web PRF, these produce the SAME
  nsec + mnemonic, i.e. one identity across web and mobile (issue #6).

    1. Nostr nsec  = BIP32(m/44'/1237'/55'/0/0) on PRF(passkey, NOSTR_SALT)
    2. Liquid seed = BIP39 mnemonic from first 16 bytes of PRF(passkey, LIQUID_SALT)

  Spec: https://github.com/breez/passkey-login/blob/main/spec.md
*/
import { HDKey } from '@scure/bip32';
import { entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { nip19, getPublicKey } from 'nostr-tools';

// "NYOASTRTSAOYN" — the Breez magic constant for Nostr account derivation.
export const NOSTR_SALT = new Uint8Array([
  0x4e, 0x59, 0x4f, 0x41, 0x53, 0x54, 0x52, 0x54, 0x53, 0x41, 0x4f, 0x59, 0x4e,
]);

// App-specific salt for the Liquid wallet seed — MUST match web verbatim.
export const LIQUID_SALT = new TextEncoder().encode('zappr-liquid-v1');

// BIP-44 derivation path for Nostr (coin index 1237, account 55 per Breez spec).
const NOSTR_PATH = "m/44'/1237'/55'/0/0";

export function deriveNsecFromPrf(prfOutput: Uint8Array): {
  nsec: string;
  hex: string;
  npub: string;
} {
  const master = HDKey.fromMasterSeed(prfOutput);
  const child = master.derive(NOSTR_PATH);
  if (!child.privateKey) throw new Error('BIP32 derivation produced no private key');
  return {
    nsec: nip19.nsecEncode(child.privateKey),
    hex: bytesToHex(child.privateKey),
    npub: nip19.npubEncode(getPublicKey(child.privateKey)),
  };
}

export function deriveMnemonicFromPrf(prfOutput: Uint8Array): string {
  const entropy = prfOutput.slice(0, 16); // 128 bits → 12 words
  return entropyToMnemonic(entropy, wordlist);
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}
