'use client';

import { useState } from 'react';
import { Zap, Loader2, Check, X } from 'lucide-react';
import { useWalletStore } from '@/store/useWalletStore';
import { lnAddressToInvoice, payInvoice } from '@/lib/wallet/lightning';

export default function ZapButton({
  targetPubkey,
  eventId,
  lud16,
}: {
  targetPubkey: string;
  eventId?: string;
  lud16?: string;
}) {
  const { provider } = useWalletStore();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(21);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zap = async () => {
    if (!provider || !lud16) {
      setError(lud16 ? 'Wallet not connected' : 'User has no Lightning address');
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const bolt11 = await lnAddressToInvoice(lud16, amount, 'zapped via zappr');
      await payInvoice(provider, bolt11);
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zap failed');
    } finally {
      setPaying(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 border-2 border-black bg-panel px-2 py-1 font-mono text-[11px] hover:bg-volt hover:text-ink transition"
      >
        <Zap className="w-3 h-3" /> Zap
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="w-20 bg-surface border-2 border-black px-2 py-1 font-mono text-[11px]"
      />
      <button
        onClick={zap}
        disabled={paying || done}
        className="flex items-center gap-1 border-2 border-black bg-orange text-ink px-2 py-1 font-mono text-[11px] disabled:opacity-60"
      >
        {paying ? <Loader2 className="w-3 h-3 animate-spin" /> : done ? <Check className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
        {done ? 'Zapped' : paying ? '...' : 'Send'}
      </button>
      <button onClick={() => setOpen(false)} className="border-2 border-black bg-panel p-1">
        <X className="w-3 h-3" />
      </button>
      {error && <span className="text-[10px] text-orange font-mono">{error}</span>}
    </div>
  );
}
