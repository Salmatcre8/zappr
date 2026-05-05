/*
  Cached lookup of Nigerian banks → NIP code. Calls MavaPay once and
  memoises the result for the lifetime of the server runtime. Lambda
  cold starts pay the cost; warm requests are free.

  Note: MavaPay's bank list field is `nipBankCode` (not `bankCode`).
  We expose a normalised shape with a `code` field to keep callers simple.
*/

import { getBanks } from './mavapay';

export type Bank = {
  name: string;
  code: string;
};

let cache: Bank[] | null = null;
let inflight: Promise<Bank[]> | null = null;

async function loadBanks(): Promise<Bank[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const raw = await getBanks();
    const list: Bank[] = raw
      .map((b) => ({ name: b.bankName, code: b.nipBankCode }))
      .filter((b) => b.name && b.code);
    cache = list;
    inflight = null;
    return list;
  })();
  return inflight;
}

export async function listBanks(): Promise<Bank[]> {
  return loadBanks();
}

/**
 * Resolve a user-typed bank name to its NIP code. Tolerant: tries exact
 * match, then case-insensitive match, then fuzzy substring match.
 */
export async function resolveBankCode(input: string): Promise<{ name: string; code: string }> {
  const banks = await loadBanks();
  const q = input.trim().toLowerCase();
  if (!q) throw new Error('Bank name is required');

  const exact = banks.find((b) => b.name.toLowerCase() === q);
  if (exact) return exact;

  // Substring match — handles "GTBank" matching "Guaranty Trust Bank Plc" etc.
  const startsWith = banks.find((b) => b.name.toLowerCase().startsWith(q));
  if (startsWith) return startsWith;

  const includes = banks.find((b) => b.name.toLowerCase().includes(q));
  if (includes) return includes;

  // Reverse — user typed a longer name than what MavaPay returned
  const reverseIncludes = banks.find((b) => q.includes(b.name.toLowerCase()));
  if (reverseIncludes) return reverseIncludes;

  throw new Error(`Bank "${input}" not found in MavaPay's list`);
}
