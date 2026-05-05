/*
  Parses NGN payout intents from natural language. Two grammars:
    1. "send 5000 ngn to 8117312955 opay"
    2. Free-form arguments coming through Anthropic tool_use — caller has
       already split fields, we just normalise + validate.

  Adapted from bitbuddy/src/utils/parser.ts.
*/

export type NgnIntent = {
  amount: number;
  accountNumber: string;
  bankName: string;
};

const COMMON_BANKS: Record<string, string> = {
  opay: 'OPAY',
  gtbank: 'GTBank',
  gtb: 'GTBank',
  access: 'Access Bank',
  zenith: 'Zenith Bank',
  uba: 'UBA',
  'first bank': 'First Bank',
  firstbank: 'First Bank',
  fidelity: 'Fidelity Bank',
  wema: 'Wema Bank',
  sterling: 'Sterling Bank',
  stanbic: 'Stanbic IBTC Bank',
  union: 'Union Bank',
  unity: 'Unity Bank',
  keystone: 'Keystone Bank',
  polaris: 'Polaris Bank',
  providus: 'Providus Bank',
  kuda: 'Kuda Bank',
  palmpay: 'PalmPay',
  moniepoint: 'Moniepoint',
};

export function normaliseBankName(input: string): string {
  const lower = input.toLowerCase().trim();
  if (COMMON_BANKS[lower]) return COMMON_BANKS[lower];
  return input
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function parseNgnPayoutMessage(message: string): NgnIntent {
  const cleaned = message
    .trim()
    .toLowerCase()
    .replace(/^(send|transfer|pay)/i, '')
    .replace(/ngn|naira/gi, '')
    .replace(/\bto\b/gi, '')
    .replace(/[,]/g, '')
    .trim();

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) {
    throw new Error(
      'Use: "send <amount> NGN to <account> <bank>" e.g. "send 3000 NGN to 8117312955 OPAY"'
    );
  }
  const amount = parseFloat(tokens[0]);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid amount: "${tokens[0]}"`);
  }
  const accountNumber = tokens[1];
  if (!/^\d{10}$/.test(accountNumber)) {
    throw new Error('Account number must be 10 digits');
  }
  const bankName = normaliseBankName(tokens.slice(2).join(' '));
  return { amount, accountNumber, bankName };
}
