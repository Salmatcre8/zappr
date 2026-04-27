import type { NwcProvider } from './nwc';
import type { WalletTx } from '@/types/wallet';

export async function getBalanceSats(provider: NwcProvider): Promise<number> {
  const res = await provider.getBalance();
  return Math.floor(res.balance);
}

export async function payInvoice(provider: NwcProvider, bolt11: string) {
  return provider.sendPayment(bolt11);
}

export async function makeInvoice(
  provider: NwcProvider,
  amountSats: number,
  memo?: string
): Promise<string> {
  const res = await provider.makeInvoice({ amount: amountSats, defaultMemo: memo });
  return res.paymentRequest;
}

export async function listTransactions(
  provider: NwcProvider,
  limit = 10
): Promise<WalletTx[]> {
  try {
    // @ts-ignore — SDK exposes listTransactions on NWC
    const res = await provider.listTransactions?.({ limit });
    const list = (res?.transactions || []) as WalletTx[];
    return list;
  } catch {
    return [];
  }
}

// Resolve a lightning address (user@domain) to a BOLT11 invoice via LNURL-pay
export async function lnAddressToInvoice(
  address: string,
  amountSats: number,
  comment?: string
): Promise<string> {
  const [name, domain] = address.split('@');
  if (!name || !domain) throw new Error('Invalid Lightning address');
  const lnurlRes = await fetch(`https://${domain}/.well-known/lnurlp/${name}`);
  if (!lnurlRes.ok) throw new Error('LNURL fetch failed');
  const lnurl = await lnurlRes.json();
  const amountMsat = amountSats * 1000;
  if (amountMsat < lnurl.minSendable || amountMsat > lnurl.maxSendable) {
    throw new Error('Amount out of range');
  }
  const params = new URLSearchParams({ amount: amountMsat.toString() });
  if (comment && lnurl.commentAllowed) params.set('comment', comment.slice(0, lnurl.commentAllowed));
  const cbRes = await fetch(`${lnurl.callback}?${params.toString()}`);
  if (!cbRes.ok) throw new Error('LNURL callback failed');
  const cb = await cbRes.json();
  if (!cb.pr) throw new Error('No invoice returned');
  return cb.pr as string;
}
