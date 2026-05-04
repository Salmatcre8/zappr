import { create } from 'zustand';
import type { WalletAdapter } from '@/lib/wallet/adapter';
import type { WalletTx } from '@/types/wallet';

type WalletState = {
  adapter: WalletAdapter | null;
  /** NWC connection string, only present for kind='nwc' connections. */
  connectionString: string | null;
  balance: number | null;
  txs: WalletTx[];
  connecting: boolean;
  error: string | null;
  setAdapter: (a: WalletAdapter, opts?: { connectionString?: string | null }) => void;
  setBalance: (b: number) => void;
  setTxs: (t: WalletTx[]) => void;
  setConnecting: (v: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;
};

export const useWalletStore = create<WalletState>((set) => ({
  adapter: null,
  connectionString: null,
  balance: null,
  txs: [],
  connecting: false,
  error: null,
  setAdapter: (a, opts) =>
    set({ adapter: a, connectionString: opts?.connectionString ?? null, error: null }),
  setBalance: (b) => set({ balance: b }),
  setTxs: (t) => set({ txs: t }),
  setConnecting: (v) => set({ connecting: v }),
  setError: (e) => set({ error: e }),
  reset: () =>
    set({ adapter: null, connectionString: null, balance: null, txs: [], error: null }),
}));
