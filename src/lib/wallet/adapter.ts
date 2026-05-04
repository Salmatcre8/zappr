/*
  WalletAdapter — single interface, two implementations (NWC + Breez).

  Lets the rest of the app (AgentChat, WalletPanel, agent tools) stay agnostic
  about which Lightning backend the user is on.
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
