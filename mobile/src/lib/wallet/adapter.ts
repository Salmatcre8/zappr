/*
  WalletAdapter — same interface as the web app (web src/lib/wallet/adapter.ts).
  Keeping the shape identical is what lets screens, the agent executor, and a
  future packages/core extraction stay backend-agnostic.
*/

import type { WalletTx } from '@/types/wallet';

export type WalletKind = 'nwc' | 'breez' | 'spark';

export interface WalletAdapter {
  kind: WalletKind;
  getBalance(): Promise<number>;
  /*
    `expectedSats` is what the user was actually shown. Adapters assert the
    invoice against it before spending (security audit F-01). Required, not
    optional, so a new call site cannot quietly omit the check.
  */
  payInvoice(bolt11: string, expectedSats: number): Promise<{ preimage?: string }>;
  makeInvoice(amountSats: number, memo?: string): Promise<string>;
  listTransactions(limit?: number): Promise<WalletTx[]>;
  disconnect?(): Promise<void>;
}
