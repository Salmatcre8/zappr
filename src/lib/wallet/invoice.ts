/*
  Invoice decoding and verification.

  Security audit F-01/F-06/F-07/F-08 all share one root cause: nothing ever
  decoded a BOLT11 invoice before paying it, so the invoice was always
  authoritative and the numbers on the confirmation screen had no relationship
  to what left the wallet. A payment proposal could describe itself however it
  liked — show "4,150 sats to your own account", attach an invoice for 500,000
  sats to someone else, and Lightning payments do not reverse.

  The rule this module enforces: the amount the user was shown is the amount
  asserted against the invoice, and only then is it paid. Everything that
  spends goes through assertInvoiceAmount().
*/
import { decode } from 'light-bolt11-decoder';

export type DecodedInvoice = {
  /** Amount in sats. 0 when the invoice specifies none (a "zero-amount" invoice). */
  sats: number;
  hasAmount: boolean;
  paymentHash: string;
  description: string;
  /** Unix seconds. 0 when the invoice carries no timestamp/expiry. */
  expiresAt: number;
  isExpired: boolean;
};

function section(sections: { name: string; value?: unknown }[], name: string): unknown {
  return sections.find((s) => s.name === name)?.value;
}

/** Decode a BOLT11 invoice. Throws on anything malformed — never returns a guess. */
export function decodeInvoice(bolt11: string): DecodedInvoice {
  const decoded = decode(bolt11.trim()) as {
    sections: { name: string; value?: unknown }[];
    expiry?: number;
  };
  const s = decoded.sections;

  const msats = section(s, 'amount');
  const hasAmount = msats !== undefined && msats !== null && String(msats) !== '0';
  const sats = hasAmount ? Number(msats) / 1000 : 0;

  const timestamp = Number(section(s, 'timestamp') ?? 0);
  const expiry = Number(decoded.expiry ?? 0);
  const expiresAt = timestamp && expiry ? timestamp + expiry : 0;

  return {
    sats,
    hasAmount,
    paymentHash: String(section(s, 'payment_hash') ?? ''),
    description: String(section(s, 'description') ?? ''),
    expiresAt,
    isExpired: expiresAt > 0 && Date.now() / 1000 > expiresAt,
  };
}

/** Raised when an invoice does not match what the user agreed to pay. */
export class InvoiceMismatchError extends Error {
  constructor(
    readonly expectedSats: number,
    readonly actualSats: number
  ) {
    super(
      `This invoice is for ${actualSats.toLocaleString()} sats, but you approved ` +
        `${expectedSats.toLocaleString()} sats. Nothing has been sent.`
    );
    this.name = 'InvoiceMismatchError';
  }
}

/*
  The gate every spend passes through.

  `expectedSats` is what the user was actually shown. A zero-amount invoice is
  accepted — the sender chooses the amount there, so there is nothing to
  contradict — but an invoice that names a different figure is refused.
*/
export function assertInvoiceAmount(bolt11: string, expectedSats: number): DecodedInvoice {
  const d = decodeInvoice(bolt11);
  if (d.isExpired) throw new Error('This invoice has expired. Ask for a new one.');
  if (d.hasAmount && Math.round(d.sats) !== Math.round(expectedSats)) {
    throw new InvoiceMismatchError(expectedSats, d.sats);
  }
  return d;
}

export type PaymentInputKind = 'bolt11' | 'lnurl' | 'lightning-address' | 'onchain' | 'unknown';

/*
  Name what the user pasted instead of making them find out by trial.

  Straight from community feedback on the build-in-public thread: "if the
  clipboard is bolt11, LNURL, or onchain, name it and continue — that extra
  hop is usually a second product."
*/
export function classifyPaymentInput(raw: string): { kind: PaymentInputKind; label: string } {
  const v = raw.trim().replace(/^lightning:/i, '');
  if (/^ln(bc|tb|bcrt)[0-9]/i.test(v)) return { kind: 'bolt11', label: 'Lightning invoice' };
  if (/^lnurl1[a-z0-9]+$/i.test(v)) return { kind: 'lnurl', label: 'LNURL' };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return { kind: 'lightning-address', label: 'Lightning address' };
  }
  // Mainnet bech32 (bc1…) and base58 (1…/3…) — zappr cannot spend these yet,
  // but saying so is far better than a generic failure.
  if (/^(bc1[a-z0-9]{8,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(v)) {
    return { kind: 'onchain', label: 'on-chain Bitcoin address' };
  }
  return { kind: 'unknown', label: 'unrecognised' };
}
