/*
  The mobile app ships its own copy of the invoice logic (this repo's
  established pattern for code shared across the two apps). A copy is only safe
  while it stays honest, so the load-bearing guarantees are asserted against the
  MOBILE module directly — if the two drift, CI says so.
*/
import { describe, it, expect } from 'vitest';
import encoder from 'bolt11';

import {
  assertInvoiceAmount,
  classifyPaymentInput,
  decodeInvoice,
  InvoiceMismatchError,
} from '../mobile/src/lib/wallet/invoice';

const THROWAWAY_KEY = '0'.repeat(63) + '1';
const HASH = '0001020304050607080900010203040506070809000102030405060708090102';

function invoice(satoshis?: number) {
  const unsigned = encoder.encode({
    ...(satoshis !== undefined ? { satoshis } : {}),
    tags: [
      { tagName: 'payment_hash', data: HASH },
      { tagName: 'description', data: 'zappr mobile test' },
    ],
  } as Parameters<typeof encoder.encode>[0]);
  return encoder.sign(unsigned, THROWAWAY_KEY).paymentRequest as string;
}

describe('mobile invoice module — parity with web', () => {
  it('decodes the amount', () => {
    expect(decodeInvoice(invoice(2500)).sats).toBe(2500);
  });

  it('REFUSES the audit scenario on mobile too', () => {
    expect(() => assertInvoiceAmount(invoice(500_000), 4150)).toThrow(InvoiceMismatchError);
  });

  it('accepts a matching invoice', () => {
    expect(assertInvoiceAmount(invoice(4150), 4150).sats).toBe(4150);
  });

  it('allows a zero-amount invoice', () => {
    expect(() => assertInvoiceAmount(invoice(), 1000)).not.toThrow();
  });

  it('classifies pasted input', () => {
    expect(classifyPaymentInput(invoice(10)).kind).toBe('bolt11');
    expect(classifyPaymentInput('satoshi@nakamoto.com').kind).toBe('lightning-address');
    expect(classifyPaymentInput('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4').kind).toBe('onchain');
  });
});
