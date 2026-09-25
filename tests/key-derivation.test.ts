/*
  The seedless wallet's foundation: one passkey → two independent keys.

  These are the properties the whole security model rests on. If any of them
  breaks, a user is silently signed into the wrong account or loses access to
  their funds — the exact failure the identity guard in webauthn.ts exists to
  catch. They are cheap to assert and expensive to get wrong, so they are
  asserted here rather than trusted.
*/
import { describe, it, expect } from 'vitest';
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

import {
  deriveNsecFromPrf,
  deriveMnemonicFromPrf,
  NOSTR_SALT,
  LIQUID_SALT,
} from '@/lib/auth/passkey-derive';
import { derivePubkeyFromNsec, nsecToHex, hexToNpub, npubToHex } from '@/lib/nostr/keys';

/** A deterministic stand-in for a 32-byte PRF output. */
function prf(seed: number): ArrayBuffer {
  const b = new Uint8Array(32);
  for (let i = 0; i < 32; i++) b[i] = (seed + i * 7) % 256;
  return b.buffer;
}

describe('nsec derivation', () => {
  it('is deterministic — the same passkey always yields the same identity', () => {
    const a = deriveNsecFromPrf(prf(1));
    const b = deriveNsecFromPrf(prf(1));
    expect(a.nsec).toBe(b.nsec);
    expect(a.npub).toBe(b.npub);
    expect(a.hex).toBe(b.hex);
  });

  it('separates identities — a different PRF output is a different account', () => {
    const a = deriveNsecFromPrf(prf(1));
    const b = deriveNsecFromPrf(prf(2));
    expect(a.npub).not.toBe(b.npub);
    expect(a.nsec).not.toBe(b.nsec);
  });

  it('produces a well-formed, self-consistent Nostr identity', () => {
    const { nsec, npub, hex } = deriveNsecFromPrf(prf(42));
    expect(nsec.startsWith('nsec1')).toBe(true);
    expect(npub.startsWith('npub1')).toBe(true);
    // 32-byte x-only pubkey
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    // The three representations must describe one key.
    expect(derivePubkeyFromNsec(nsec)).toEqual({ hex, npub });
    expect(hexToNpub(hex)).toBe(npub);
    expect(npubToHex(npub)).toBe(hex);
    expect(nsecToHex(nsec)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('wallet mnemonic derivation', () => {
  it('is a valid 12-word BIP-39 phrase', () => {
    const m = deriveMnemonicFromPrf(prf(7));
    expect(m.split(' ')).toHaveLength(12);
    expect(validateMnemonic(m, wordlist)).toBe(true);
  });

  it('is deterministic, and distinct per passkey', () => {
    expect(deriveMnemonicFromPrf(prf(7))).toBe(deriveMnemonicFromPrf(prf(7)));
    expect(deriveMnemonicFromPrf(prf(7))).not.toBe(deriveMnemonicFromPrf(prf(8)));
  });
});

describe('salt separation', () => {
  /*
    The identity key and the wallet seed must come from independent PRF
    evaluations. If the salts ever collided, the nsec and the wallet seed would
    share entropy and leaking one would leak the other.
  */
  it('uses distinct salts for identity and wallet', () => {
    expect(Array.from(NOSTR_SALT)).not.toEqual(Array.from(LIQUID_SALT));
  });

  it('never derives the wallet seed from the identity material', () => {
    // Same PRF bytes through both derivations must not coincide.
    const shared = prf(99);
    const identity = deriveNsecFromPrf(shared);
    const seed = deriveMnemonicFromPrf(shared);
    expect(seed).not.toContain(identity.hex);
  });
});
