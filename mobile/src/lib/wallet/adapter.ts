/*
  WalletAdapter — same interface as the web app (web src/lib/wallet/adapter.ts).
  Keeping the shape identical is what lets screens, the agent executor, and a
  future packages/core extraction stay backend-agnostic.
*/

import type { WalletTx } from '@/types/wallet';

export type WalletKind = 'nwc' | 'breez';

export interface WalletAdapter {
  kind: WalletKind;
  getBalance(): Promise<number>;
  payInvoice(bolt11: string): Promise<{ preimage?: string }>;
  makeInvoice(amountSats: number, memo?: string): Promise<string>;
  listTransactions(limit?: number): Promise<WalletTx[]>;
  disconnect?(): Promise<void>;
}
