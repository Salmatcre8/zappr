'use client';

import { useState } from 'react';
import { Wallet, Loader2 } from 'lucide-react';
import { NwcAdapter } from '@/lib/wallet/nwcAdapter';
import { useWalletStore } from '@/store/useWalletStore';

export default function ConnectWallet() {
  const [value, setValue] = useState('');
  const { connecting, error, setConnecting, setError, setAdapter, setBalance, setTxs } =
    useWalletStore();

  const connect = async () => {
    if (!value.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      const adapter = await NwcAdapter.connect(value.trim());
      setAdapter(adapter, { connectionString: value.trim() });
      try {
        setBalance(await adapter.getBalance());
        setTxs(await adapter.listTransactions(5));
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connect failed');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="brut-panel p-4 space-y-3">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-bone/60">
        <Wallet className="w-3.5 h-3.5" /> Connect Wallet
      </div>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="nostr+walletconnect://..."
        className="brut-input text-[11px]"
      />
      {error && <div className="text-[11px] text-orange font-mono">{error}</div>}
      <button onClick={connect} disabled={connecting} className="brut-btn w-full flex items-center justify-center gap-2">
        {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
        {connecting ? 'Connecting…' : 'Connect NWC'}
      </button>
    </div>
  );
}
