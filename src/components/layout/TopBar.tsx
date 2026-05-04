'use client';

import { Zap, Radio, LogOut } from 'lucide-react';
import { useNostrStore } from '@/store/useNostrStore';
import { useWalletStore } from '@/store/useWalletStore';
import { truncateNpub } from '@/lib/nostr/keys';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import { clearSession } from '@/lib/auth/session';
import { vaultClear, vaultGet } from '@/lib/auth/vault';

export default function TopBar() {
  const router = useRouter();
  const { npub, reset: resetNostr } = useNostrStore();
  const { adapter, reset: resetWallet } = useWalletStore();

  const logout = async () => {
    clearSession();
    // For derived-mode vaults the IndexedDB blob is just a public credential
    // id — clearing it would block biometric re-login even though the passkey
    // itself still lives on the device. Only wipe encrypted (legacy) vaults
    // where the blob holds the encrypted nsec.
    const blob = await vaultGet();
    if (blob?.kind !== 'derived') {
      await vaultClear();
    }
    if (adapter?.kind === 'breez') {
      try {
        await adapter.disconnect?.();
      } catch {}
    }
    resetNostr();
    resetWallet();
    router.replace('/login');
  };

  return (
    <header className="brut-panel mx-3 md:mx-4 mt-3 md:mt-4 px-3 md:px-4 py-2.5 md:py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <div className="w-8 h-8 bg-orange flex items-center justify-center border-2 border-black shrink-0">
          <Zap className="w-4 h-4 text-ink" strokeWidth={3} />
        </div>
        <span className="font-mono text-lg md:text-xl font-bold">zappr</span>
      </div>
      <div className="flex items-center gap-2 md:gap-3 font-mono text-xs">
        <div className="hidden sm:flex items-center gap-1.5">
          <Radio className={`w-3.5 h-3.5 ${adapter ? 'text-volt' : 'text-bone/30'}`} />
          <span className="text-bone/60">
            {adapter ? (adapter.kind === 'breez' ? 'WALLET LIVE' : 'NWC LIVE') : 'WALLET OFF'}
          </span>
        </div>
        <span className="hidden md:inline text-bone/70">{npub ? truncateNpub(npub) : ''}</span>
        <ThemeToggle />
        <button
          onClick={logout}
          aria-label="Log out"
          className="border-2 border-black bg-panel p-1.5 hover:bg-orange hover:text-ink transition"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
