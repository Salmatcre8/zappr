import { create } from 'zustand';
import type { NwcProvider } from '@/lib/wallet/nwc';
import type { WalletTx } from '@/types/wallet';

type WalletState = {
  provider: NwcProvider | null;
  connectionString: string | null;
  balance: number | null;
  txs: WalletTx[];
  connecting: boolean;
  error: string | null;
  setProvider: (p: NwcProvider, cs: string) => void;
  setBalance: (b: number) => void;
  setTxs: (t: WalletTx[]) => void;
  setConnecting: (v: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;
};

export const useWalletStore = create<WalletState>((set) => ({
  provider: null,
  connectionString: null,
  balance: null,
  txs: [],
  connecting: false,
  error: null,
  setProvider: (p, cs) => set({ provider: p, connectionString: cs, error: null }),
  setBalance: (b) => set({ balance: b }),
  setTxs: (t) => set({ txs: t }),
  setConnecting: (v) => set({ connecting: v }),
  setError: (e) => set({ error: e }),
  reset: () =>
    set({ provider: null, connectionString: null, balance: null, txs: [], error: null }),
}));
