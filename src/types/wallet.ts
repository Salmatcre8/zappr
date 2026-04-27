export type WalletTx = {
  type: 'incoming' | 'outgoing';
  amount: number;
  fees_paid?: number;
  created_at: number;
  description?: string;
  payment_hash?: string;
  settled_at?: number;
};

export type WalletInfo = {
  alias?: string;
  balance: number;
};
