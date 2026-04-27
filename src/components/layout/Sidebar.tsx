'use client';

import WalletPanel from '@/components/wallet/WalletPanel';
import ConnectWallet from '@/components/wallet/ConnectWallet';
import { useWalletStore } from '@/store/useWalletStore';
import { useNostrStore } from '@/store/useNostrStore';
import { truncateNpub } from '@/lib/nostr/keys';
import { User } from 'lucide-react';

export default function Sidebar() {
  const { provider } = useWalletStore();
  const { npub } = useNostrStore();

  return (
    <div className="space-y-4">
      <div className="brut-panel p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-volt flex items-center justify-center border-2 border-black">
            <User className="w-6 h-6 text-ink" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-widest text-bone/50">Identity</div>
            <div className="font-mono text-sm truncate">{npub ? truncateNpub(npub, 10) : '—'}</div>
          </div>
        </div>
      </div>

      {provider ? <WalletPanel /> : <ConnectWallet />}
    </div>
  );
}
