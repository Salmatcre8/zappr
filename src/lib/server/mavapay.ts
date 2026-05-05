/*
  MavaPay client — Lightning → NGN bank transfers (offramp).

  Server-only. The MAVAPAY_API_KEY is a real secret and must never reach the
  browser bundle. All callers should be Next.js route handlers.

  Adapted from bitbuddy/src/services/mavapay.service.ts. Notable changes:
    - axios → native fetch (one fewer dep)
    - The dual axios-client header-casing workaround is removed; we always
      send `X-API-KEY` (uppercase) which the staging API accepts.
    - Console logging trimmed to keep prod logs clean.

  Reference flow: https://docs.mavapay.co/
*/

const BASE = process.env.MAVAPAY_BASE_URL || 'https://staging.api.mavapay.co/api/v1';

function authHeaders(): HeadersInit {
  const key = process.env.MAVAPAY_API_KEY;
  if (!key) throw new Error('MAVAPAY_API_KEY not configured');
  return {
    'X-API-KEY': key,
    'Content-Type': 'application/json',
  };
}

async function mvFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
    cache: 'no-store',
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      (body && typeof body === 'object' && 'message' in body && typeof (body as { message?: string }).message === 'string')
        ? (body as { message: string }).message
        : `MavaPay HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

// ---- Types (mirror staging API responses) ----

export type BankInfo = {
  bankName: string;
  nipBankCode: string;
};

export type AccountValidation = {
  accountName: string;
  accountNumber: string;
  bankCode: string;
};

export type QuoteResponse = {
  id: string;
  orderId: string;
  amount: number;
  amountInSourceCurrency: number;
  amountInTargetCurrency: number;
  transactionFeesInSourceCurrency: number;
  transactionFeesInTargetCurrency: number;
  invoice: string;
  hash: string;
  expiry: string;
  exchangeRate: number;
  usdToTargetCurrencyRate?: number;
  isValid: boolean;
  totalAmountInSourceCurrency: number;
  customerInternalFee?: number;
};

export type TransactionStatus = {
  orderId: string;
  status: 'pending' | 'paid' | 'sent' | 'failed' | string;
  // Other fields vary; expose generically.
  [key: string]: unknown;
};

// ---- API ----

export async function getBanks(): Promise<BankInfo[]> {
  const res = await mvFetch<{ data: BankInfo[] }>('/bank/bankcode?country=NG');
  return res.data || [];
}

/**
 * Best-effort name enquiry. Mavapay's staging endpoint is finicky (returns
 * 404 sometimes); we try POST → POST-with-body → GET in that order. If all
 * three fail we throw 'VALIDATION_NOT_AVAILABLE' so the caller can fall back
 * to a user-confirmed manual name.
 */
export async function validateAccount(
  accountNumber: string,
  bankCode: string
): Promise<AccountValidation> {
  const attempts: Array<() => Promise<AccountValidation>> = [
    async () => {
      const r = await mvFetch<{ data?: AccountValidation }>(
        `/bank/name-enquiry?accountNumber=${accountNumber}&bankCode=${bankCode}`,
        { method: 'POST', body: '{}' }
      );
      return (r.data ?? (r as unknown)) as AccountValidation;
    },
    async () => {
      const r = await mvFetch<{ data?: AccountValidation }>('/bank/name-enquiry', {
        method: 'POST',
        body: JSON.stringify({ accountNumber, bankCode }),
      });
      return (r.data ?? (r as unknown)) as AccountValidation;
    },
    async () => {
      const r = await mvFetch<{ data?: AccountValidation }>(
        `/bank/name-enquiry?accountNumber=${accountNumber}&bankCode=${bankCode}`
      );
      return (r.data ?? (r as unknown)) as AccountValidation;
    },
  ];

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    typeof lastErr === 'object' && lastErr && 'message' in lastErr
      ? 'VALIDATION_NOT_AVAILABLE'
      : 'VALIDATION_NOT_AVAILABLE'
  );
}

/**
 * Create an offramp quote: user pays a Lightning invoice, MavaPay pays out
 * NGN to the named bank account. `amountNgn` is in whole naira; we convert
 * to kobo internally. Minimum is 2,000 NGN.
 */
export async function createQuote(args: {
  amountNgn: number;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName?: string;
}): Promise<QuoteResponse> {
  const amountInKobo = Math.round(args.amountNgn * 100);
  if (amountInKobo < 200_000) {
    throw new Error('Minimum payout amount is 2,000 NGN');
  }

  const payload = {
    amount: amountInKobo,
    sourceCurrency: 'BTCSAT',
    targetCurrency: 'NGNKOBO',
    paymentMethod: 'LIGHTNING',
    paymentCurrency: 'NGNKOBO',
    autopayout: true,
    beneficiary: {
      bankAccountNumber: args.accountNumber,
      bankAccountName: args.accountName || 'Account Holder',
      bankCode: args.bankCode,
      bankName: args.bankName,
    },
  };

  const res = await mvFetch<{ data: QuoteResponse }>('/quote', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.data) throw new Error('Quote response missing data');
  return res.data;
}

/**
 * Staging-only — MavaPay simulates the user paying the Lightning invoice
 * against a quote, which auto-triggers the NGN payout. Useful for end-to-end
 * demos without a funded Lightning wallet. Don't call in production.
 */
export async function simulatePayment(quoteId: string): Promise<{ success: true; message: string }> {
  const res = await mvFetch<{ message?: string }>('/simulation/pay-in', {
    method: 'POST',
    body: JSON.stringify({ currency: 'BTC', quoteId }),
  });
  return { success: true, message: res.message || 'Payment simulated successfully' };
}

export async function getTransactionStatus(orderId: string): Promise<TransactionStatus> {
  const res = await mvFetch<{ data: TransactionStatus }>(`/transaction/${orderId}`);
  return res.data;
}

export function isStaging(): boolean {
  return BASE.includes('staging');
}
