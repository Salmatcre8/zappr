import { NextRequest, NextResponse } from 'next/server';
import { createQuote, validateAccount } from '@/lib/server/mavapay';
import { resolveBankCode } from '@/lib/server/banks';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: {
    amount_ngn?: number;
    account_number?: string;
    bank?: string;
    account_name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const amount = Number(body.amount_ngn);
  const accountNumber = String(body.account_number || '').trim();
  const bankInput = String(body.bank || '').trim();

  if (!Number.isFinite(amount) || amount < 2000) {
    return NextResponse.json(
      { error: 'amount_ngn must be at least 2000' },
      { status: 400 }
    );
  }
  if (!/^\d{10}$/.test(accountNumber)) {
    return NextResponse.json(
      { error: 'account_number must be 10 digits' },
      { status: 400 }
    );
  }
  if (!bankInput) {
    return NextResponse.json({ error: 'bank is required' }, { status: 400 });
  }

  try {
    const bank = await resolveBankCode(bankInput);

    let accountName = body.account_name?.trim();
    if (!accountName) {
      try {
        const v = await validateAccount(accountNumber, bank.code);
        accountName = v.accountName;
      } catch {
        // Name enquiry is unreliable on staging; fall back to a generic label
        // and let the user confirm before approval.
        accountName = 'Account Holder';
      }
    }

    const quote = await createQuote({
      amountNgn: amount,
      accountNumber,
      bankCode: bank.code,
      bankName: bank.name,
      accountName,
    });

    return NextResponse.json({
      quote_id: quote.id,
      order_id: quote.orderId,
      invoice: quote.invoice,
      sats_to_send: quote.amountInSourceCurrency,
      ngn_to_receive: Math.round(quote.amountInTargetCurrency / 100),
      fee_sats: quote.transactionFeesInSourceCurrency,
      total_sats: quote.totalAmountInSourceCurrency,
      exchange_rate: quote.exchangeRate,
      expiry: quote.expiry,
      bank: { name: bank.name, code: bank.code },
      account: { number: accountNumber, name: accountName },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Quote failed' },
      { status: 500 }
    );
  }
}
