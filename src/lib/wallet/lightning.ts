/*
  Backend-agnostic Lightning helpers. Wallet methods live on WalletAdapter;
  this file only holds protocol helpers (LNURL-pay) that aren't tied to a
  specific wallet backend.
*/

// Resolve a lightning address (user@domain) to a BOLT11 invoice via LNURL-pay.
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
  if (comment && lnurl.commentAllowed)
    params.set('comment', comment.slice(0, lnurl.commentAllowed));
  const cbRes = await fetch(`${lnurl.callback}?${params.toString()}`);
  if (!cbRes.ok) throw new Error('LNURL callback failed');
  const cb = await cbRes.json();
  if (!cb.pr) throw new Error('No invoice returned');
  return cb.pr as string;
}
