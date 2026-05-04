'use client';

import { useState } from 'react';
import WalletPanel from '@/components/wallet/WalletPanel';
import ConnectWallet from '@/components/wallet/ConnectWallet';
import BackupPhraseCard from '@/components/wallet/BackupPhraseCard';
import { useWalletStore } from '@/store/useWalletStore';
import { useNostrStore } from '@/store/useNostrStore';
import { truncateNpub } from '@/lib/nostr/keys';
import { User, Copy, Check } from 'lucide-react';

export default function Sidebar() {
  const { adapter } = useWalletStore();
  const { npub } = useNostrStore();
  const [copied, setCopied] = useState(false);

  const copyNpub = async () => {
    if (!npub) return;
    try {
      await navigator.clipboard.writeText(npub);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="brut-panel p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-volt flex items-center justify-center border-2 border-black shrink-0">
            <User className="w-6 h-6 text-ink" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-widest text-bone/50">Identity</div>
            <div className="font-mono text-sm truncate">{npub ? truncateNpub(npub, 10) : '—'}</div>
          </div>
          {npub && (
            <button
              onClick={copyNpub}
              aria-label="Copy npub"
              className="border-2 border-black bg-panel p-1.5 hover:bg-orange hover:text-ink transition shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {adapter ? <WalletPanel /> : <ConnectWallet />}
      <BackupPhraseCard />
    </div>
  );
}
