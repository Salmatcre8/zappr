'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ArrowUpRight, ArrowDownLeft, Zap } from 'lucide-react';
import { useWalletStore } from '@/store/useWalletStore';
import { getBalanceSats, listTransactions } from '@/lib/wallet/lightning';
import { formatDistanceToNowStrict } from 'date-fns';

export default function WalletPanel() {
  const { provider, balance, txs, setBalance, setTxs } = useWalletStore();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (!provider) return;
    setRefreshing(true);
    try {
      const bal = await getBalanceSats(provider);
      setBalance(bal);
      const list = await listTransactions(provider, 5);
      setTxs(list);
    } catch {}
    setRefreshing(false);
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  return (
    <div className="brut-panel p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-bone/60">
          <Zap className="w-3.5 h-3.5 text-orange" /> Wallet
        </div>
        <button
          onClick={refresh}
          className="border-2 border-black bg-panel p-1.5 hover:bg-orange hover:text-ink transition"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-surface border-2 border-black p-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-bone/50">Balance</div>
        <div className="font-mono text-3xl font-bold text-orange mt-1">
          {balance !== null ? balance.toLocaleString() : '—'}
        </div>
        <div className="font-mono text-[10px] text-bone/50 mt-0.5">sats</div>
      </div>

      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-bone/50 mb-2">
          Recent
        </div>
        {txs.length === 0 ? (
          <div className="font-mono text-[11px] text-bone/40">No transactions yet</div>
        ) : (
          <ul className="space-y-1.5">
            {txs.slice(0, 5).map((t, i) => {
              const incoming = t.type === 'incoming';
              const when = t.settled_at || t.created_at;
              return (
                <li key={i} className="flex items-center justify-between text-[11px] font-mono border border-line px-2 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {incoming ? (
                      <ArrowDownLeft className="w-3 h-3 text-volt shrink-0" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3 text-orange shrink-0" />
                    )}
                    <span className="truncate text-bone/70">{t.description || (incoming ? 'received' : 'sent')}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={incoming ? 'text-volt' : 'text-orange'}>
                      {incoming ? '+' : '-'}{t.amount}
                    </span>
                    {when ? (
                      <span className="text-bone/40 text-[9px]">
                        {formatDistanceToNowStrict(new Date(when * 1000))} ago
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
