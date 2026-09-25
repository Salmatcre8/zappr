/*
  Recovery and cross-device sync — the two paths where a mistake costs a user
  their money rather than their patience.

  1. The restore flow must accept a real phrase typed by a human (messy case,
     stray spacing) and reject anything it cannot actually restore, rather than
     accepting it and seeding an empty wallet.
  2. The NIP-78 record carrying the NWC connection string is a bearer
     credential. It must round-trip for its owner and be unreadable to anyone
     else, because relays store it in the open.
*/
import { describe, it, expect } from 'vitest';
import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { nip19, nip44, generateSecretKey, getPublicKey } from 'nostr-tools';

/** Exactly the normalisation the restore forms apply before validating. */
function normalise(input: string): string {
  return input.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

describe('restore from recovery phrase', () => {
  const phrase = generateMnemonic(wordlist, 128);

  it('accepts a valid phrase', () => {
    expect(validateMnemonic(normalise(phrase), wordlist)).toBe(true);
  });

  it('accepts the messy shapes people actually paste', () => {
    const messy = `  ${phrase.toUpperCase().replace(/ /g, '   ')}\n`;
    expect(normalise(messy)).toBe(phrase);
    expect(validateMnemonic(normalise(messy), wordlist)).toBe(true);
  });

  /*
    Fixed vectors, not generated ones, for the negative cases.

    A 12-word phrase carries only a 4-bit checksum, so a randomly tampered word
    still validates roughly 1 run in 16 — which is exactly how this test failed
    in CI after passing locally. Deterministic inputs or it is not a test.
  */
  const KNOWN_GOOD = 'abandon '.repeat(11) + 'about';

  it('accepts the canonical all-zero-entropy vector', () => {
    expect(validateMnemonic(KNOWN_GOOD, wordlist)).toBe(true);
  });

  it('rejects a phrase with one wrong word (checksum catches typos)', () => {
    // 'about' is the only valid final word for this entropy; any other fails.
    expect(validateMnemonic('abandon '.repeat(11) + 'abandon', wordlist)).toBe(false);
  });

  it('rejects a truncated phrase', () => {
    expect(validateMnemonic(phrase.split(' ').slice(0, 9).join(' '), wordlist)).toBe(false);
  });

  it('rejects words outside the BIP-39 wordlist', () => {
    expect(validateMnemonic('hello world '.repeat(6).trim(), wordlist)).toBe(false);
  });

  it('rejects a reordered phrase', () => {
    // Deterministic: moving the checksum word out of final position invalidates.
    expect(validateMnemonic('about ' + 'abandon '.repeat(11).trim(), wordlist)).toBe(false);
  });
});

describe('NIP-78 NWC sync envelope', () => {
  /*
    Mirrors app-data.ts: the conversation key is derived from the user's own
    secret and their own pubkey, so it both encrypts and decrypts.
  */
  function selfKey(sk: Uint8Array) {
    return nip44.getConversationKey(sk, getPublicKey(sk));
  }
  const nwc = 'nostr+walletconnect://abc?relay=wss://r.example&secret=deadbeef';

  it('round-trips for the owner', () => {
    const sk = generateSecretKey();
    const payload = JSON.stringify({ nwc });
    const ct = nip44.encrypt(payload, selfKey(sk));
    expect(nip44.decrypt(ct, selfKey(sk))).toBe(payload);
  });

  it('never leaves the connection string in the clear', () => {
    const sk = generateSecretKey();
    const ct = nip44.encrypt(JSON.stringify({ nwc }), selfKey(sk));
    expect(ct).not.toContain('walletconnect');
    expect(ct).not.toContain('deadbeef');
  });

  it('is unreadable to any other key', () => {
    const mine = generateSecretKey();
    const theirs = generateSecretKey();
    const ct = nip44.encrypt(JSON.stringify({ nwc }), selfKey(mine));
    expect(() => nip44.decrypt(ct, selfKey(theirs))).toThrow();
  });

  it('derives the same key from an nsec as from raw bytes (what the app stores)', () => {
    const sk = generateSecretKey();
    const decoded = nip19.decode(nip19.nsecEncode(sk));
    expect(decoded.type).toBe('nsec');
    expect(selfKey(decoded.data as Uint8Array)).toEqual(selfKey(sk));
  });
});
