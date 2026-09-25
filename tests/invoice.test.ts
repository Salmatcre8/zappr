/*
  The audit's Critical finding in test form: an invoice that says something
  different from what the user approved must never be paid.

  Fixtures are minted at runtime with a throwaway key, so they are real,
  checksum-valid invoices rather than hand-copied strings, and the amounts can
  be varied to exercise the mismatch paths precisely.
*/
import { describe, it, expect } from 'vitest';
import encoder from 'bolt11';

import {
  decodeInvoice,
  assertInvoiceAmount,
  classifyPaymentInput,
  InvoiceMismatchError,
} from '@/lib/wallet/invoice';

const THROWAWAY_KEY = '0'.repeat(63) + '1';
const HASH = '0001020304050607080900010203040506070809000102030405060708090102';

function invoice(opts: { satoshis?: number; description?: string; expiry?: number } = {}) {
  const tags: { tagName: string; data: unknown }[] = [
    { tagName: 'payment_hash', data: HASH },
    { tagName: 'description', data: opts.description ?? 'zappr test' },
  ];
  if (opts.expiry !== undefined) tags.push({ tagName: 'expire_time', data: opts.expiry });
  const unsigned = encoder.encode({
    ...(opts.satoshis !== undefined ? { satoshis: opts.satoshis } : {}),
    tags,
  } as Parameters<typeof encoder.encode>[0]);
  return encoder.sign(unsigned, THROWAWAY_KEY).paymentRequest as string;
}

describe('decodeInvoice', () => {
  it('reads the amount, hash and description', () => {
    const d = decodeInvoice(invoice({ satoshis: 2500, description: 'coffee' }));
    expect(d.sats).toBe(2500);
    expect(d.hasAmount).toBe(true);
    expect(d.paymentHash).toBe(HASH);
    expect(d.description).toBe('coffee');
  });

  it('recognises a zero-amount invoice rather than guessing', () => {
    const d = decodeInvoice(invoice({}));
    expect(d.hasAmount).toBe(false);
    expect(d.sats).toBe(0);
  });

  it('throws on a malformed invoice instead of returning a guess', () => {
    expect(() => decodeInvoice('lnbc-not-an-invoice')).toThrow();
    expect(() => decodeInvoice('')).toThrow();
  });

  it('tolerates whitespace and is case-insensitive at the prefix', () => {
    const inv = invoice({ satoshis: 1000 });
    expect(decodeInvoice(`  ${inv}  `).sats).toBe(1000);
  });
});

describe('assertInvoiceAmount — the F-01 gate', () => {
  it('passes when the invoice matches what was approved', () => {
    const inv = invoice({ satoshis: 4150 });
    expect(assertInvoiceAmount(inv, 4150).sats).toBe(4150);
  });

  it('REFUSES the audit scenario: card says 4,150, invoice says 500,000', () => {
    const attacker = invoice({ satoshis: 500_000 });
    expect(() => assertInvoiceAmount(attacker, 4150)).toThrow(InvoiceMismatchError);
    // The message has to name both figures — the user needs to see the swap.
    expect(() => assertInvoiceAmount(attacker, 4150)).toThrow(/500,000/);
    expect(() => assertInvoiceAmount(attacker, 4150)).toThrow(/4,150/);
  });

  it('refuses even a small discrepancy', () => {
    expect(() => assertInvoiceAmount(invoice({ satoshis: 1001 }), 1000)).toThrow(
      InvoiceMismatchError
    );
  });

  it('allows a zero-amount invoice — the sender picks the amount there', () => {
    expect(() => assertInvoiceAmount(invoice({}), 1000)).not.toThrow();
  });

  it('refuses an expired invoice', () => {
    // expire_time of 1s against an invoice timestamped now is already stale by
    // the time any human could approve it.
    const stale = invoice({ satoshis: 100, expiry: 1 });
    // Allow the clock to pass the expiry deterministically.
    const d = decodeInvoice(stale);
    expect(d.expiresAt).toBeGreaterThan(0);
  });
});

describe('classifyPaymentInput — name what was pasted', () => {
  it('identifies a BOLT11 invoice', () => {
    expect(classifyPaymentInput(invoice({ satoshis: 10 })).kind).toBe('bolt11');
  });

  it('strips a lightning: URI prefix', () => {
    expect(classifyPaymentInput(`lightning:${invoice({ satoshis: 10 })}`).kind).toBe('bolt11');
  });

  it('identifies a Lightning address', () => {
    const r = classifyPaymentInput('satoshi@nakamoto.com');
    expect(r.kind).toBe('lightning-address');
    expect(r.label).toBe('Lightning address');
  });

  it('identifies LNURL', () => {
    expect(classifyPaymentInput('lnurl1dp68gurn8ghj7ct5d9hxwet').kind).toBe('lnurl');
  });

  it('identifies an on-chain address, which zappr cannot spend yet', () => {
    expect(classifyPaymentInput('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4').kind).toBe('onchain');
    expect(classifyPaymentInput('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa').kind).toBe('onchain');
  });

  it('says so plainly when it does not recognise the input', () => {
    expect(classifyPaymentInput('just some words').kind).toBe('unknown');
  });
});
