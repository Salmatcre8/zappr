/*
  Backend-agnostic Lightning helpers. Wallet methods live on WalletAdapter;
  this file only holds protocol helpers (LNURL-pay) that aren't tied to a
  specific wallet backend.

  Security audit F-06: this used to ask a Lightning address server for an
  invoice of N sats and then return whatever came back, unverified — so the
  server on the other end, or anyone able to MITM or DNS-hijack it, chose what
  you paid. Three holes are closed below: the returned invoice is decoded and
  its amount asserted, the callback is pinned to HTTPS on the address's own
  domain, and a server that omits its sendable range is refused rather than
  silently passing an unbounded check against `undefined`.
*/
import { decodeInvoice } from './invoice';

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

  /*
    Missing bounds used to compare against `undefined` — both comparisons
    false, so the range check passed with no range at all. Fail closed.
  */
  if (!Number.isFinite(lnurl.minSendable) || !Number.isFinite(lnurl.maxSendable)) {
    throw new Error('That Lightning address did not declare a sendable range');
  }
  if (amountMsat < lnurl.minSendable || amountMsat > lnurl.maxSendable) {
    throw new Error('Amount out of range');
  }

  // Pin the callback: HTTPS, on the domain the address actually named.
  let callback: URL;
  try {
    callback = new URL(String(lnurl.callback));
  } catch {
    throw new Error('LNURL callback is not a valid URL');
  }
  if (callback.protocol !== 'https:') throw new Error('LNURL callback must be HTTPS');
  if (callback.hostname !== domain && !callback.hostname.endsWith(`.${domain}`)) {
    throw new Error('LNURL callback points at a different domain — refusing');
  }

  const params = new URLSearchParams({ amount: amountMsat.toString() });
  if (comment && lnurl.commentAllowed) {
    params.set('comment', comment.slice(0, lnurl.commentAllowed));
  }

  const cbRes = await fetch(`${callback.toString()}?${params.toString()}`);
  if (!cbRes.ok) throw new Error('LNURL callback failed');
  const cb = await cbRes.json();
  if (!cb.pr) throw new Error('No invoice returned');

  /*
    The spec requires this and it is the whole point: the invoice handed back
    must encode the amount we asked for.
  */
  const decoded = decodeInvoice(String(cb.pr));
  if (decoded.hasAmount && Math.round(decoded.sats) !== Math.round(amountSats)) {
    throw new Error(
      `That Lightning address returned an invoice for ${decoded.sats.toLocaleString()} sats, ` +
        `not the ${amountSats.toLocaleString()} you asked for. Nothing has been sent.`
    );
  }

  return cb.pr as string;
}
