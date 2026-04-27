'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, Wallet, Bot, Loader2 } from 'lucide-react';
import { useNostrStore } from '@/store/useNostrStore';
import { useWalletStore } from '@/store/useWalletStore';
import { initNDK } from '@/lib/nostr/ndk';
import { derivePubkeyFromNsec } from '@/lib/nostr/keys';
import { connectNWC } from '@/lib/wallet/nwc';
import { getBalanceSats } from '@/lib/wallet/lightning';
import { loadSession, clearSession } from '@/lib/auth/session';
import TopBar from '@/components/layout/TopBar';
import Sidebar from '@/components/layout/Sidebar';
import RightPanel from '@/components/layout/RightPanel';
import UnifiedFeed from '@/components/feed/UnifiedFeed';
import BiometricSetupBanner from '@/components/auth/BiometricSetupBanner';

type Tab = 'wallet' | 'feed' | 'agent';

export default function DashboardPage() {
  const router = useRouter();
  const { pubkey, ndk, setNdk, setIdentity } = useNostrStore();
  const [tab, setTab] = useState<Tab>('feed');
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Already hydrated in-memory (came from /login push) — nothing to do.
    if (pubkey && ndk) {
      setHydrating(false);
      return;
    }

    // Try to rehydrate from sessionStorage (survives a page refresh).
    (async () => {
      const session = loadSession();
      if (!session || (!session.nsec && !session.useNip07)) {
        router.replace('/login');
        return;
      }
      try {
        let hex: string;
        let npub: string;
        let ndkInst;
        if (session.useNip07) {
          ndkInst = await initNDK({ useNip07: true });
          const signer = ndkInst.signer;
          if (!signer) throw new Error('NIP-07 signer unavailable');
          const user = await signer.user();
          hex = user.pubkey;
          npub = user.npub;
        } else {
          const derived = derivePubkeyFromNsec(session.nsec!);
          hex = derived.hex;
          npub = derived.npub;
          ndkInst = await initNDK({ nsec: session.nsec! });
        }
        if (cancelled) return;
        setNdk(ndkInst);
        setIdentity(hex, npub);

        if (session.nwc) {
          try {
            const provider = await connectNWC(session.nwc);
            useWalletStore.getState().setProvider(provider, session.nwc);
            const bal = await getBalanceSats(provider);
            useWalletStore.getState().setBalance(bal);
          } catch {
            // Wallet rehydration is best-effort. The user can reconnect manually.
          }
        }

        if (!cancelled) setHydrating(false);
      } catch {
        // Stored nsec is corrupt or NDK failed to connect — wipe and force re-login.
        clearSession();
        if (!cancelled) router.replace('/login');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pubkey, ndk, router, setNdk, setIdentity]);

  if (hydrating) {
    return (
      <div className="h-[100dvh] flex items-center justify-center">
        <div className="flex items-center gap-3 font-mono text-xs text-bone/60">
          <Loader2 className="w-4 h-4 animate-spin" /> restoring session…
        </div>
      </div>
    );
  }

  if (!pubkey || !ndk) return null;

  const tabs: { key: Tab; label: string; icon: typeof Radio }[] = [
    { key: 'wallet', label: 'Wallet', icon: Wallet },
    { key: 'feed', label: 'Feed', icon: Radio },
    { key: 'agent', label: 'Agent', icon: Bot },
  ];

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <TopBar />
      <BiometricSetupBanner />

      {/* Desktop: three-column grid */}
      <div className="hidden lg:grid lg:grid-cols-[320px_1fr_380px] lg:grid-rows-[minmax(0,1fr)] gap-4 p-4 flex-1 min-h-0">
        <aside className="min-h-0 overflow-y-auto">
          <Sidebar />
        </aside>
        <main className="min-w-0 min-h-0">
          <UnifiedFeed />
        </main>
        <aside className="min-h-0">
          <RightPanel />
        </aside>
      </div>

      {/* Mobile: single active panel */}
      <div className="lg:hidden flex-1 min-h-0 p-3 pb-20">
        <div className="h-[calc(100dvh-180px)]">
          {tab === 'wallet' && (
            <div className="h-full overflow-y-auto pr-1">
              <Sidebar />
            </div>
          )}
          {tab === 'feed' && <UnifiedFeed />}
          {tab === 'agent' && <RightPanel />}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-panel border-t-2 border-black flex z-30">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 border-r-2 border-black last:border-r-0 font-mono text-[10px] uppercase tracking-widest transition ${
                active ? 'bg-orange text-ink' : 'hover:bg-surface'
              }`}
            >
              <t.icon className="w-4 h-4" strokeWidth={2.5} />
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
