'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, Wallet, Bot, Loader2 } from 'lucide-react';
import { useNostrStore } from '@/store/useNostrStore';
import { useWalletStore } from '@/store/useWalletStore';
import { initNDK } from '@/lib/nostr/ndk';
import { derivePubkeyFromNsec } from '@/lib/nostr/keys';
import { NwcAdapter } from '@/lib/wallet/nwcAdapter';
import { BreezAdapter } from '@/lib/wallet/breezAdapter';
import { loadSession, clearSession } from '@/lib/auth/session';
import { vaultGet } from '@/lib/auth/vault';
import { unlockVault } from '@/lib/auth/webauthn';
import {
  assertPasskey,
  deriveNsecFromPrf,
  deriveMnemonicFromPrf,
} from '@/lib/auth/passkey-derive';
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
  const [hydrationLabel, setHydrationLabel] = useState('restoring session…');

  useEffect(() => {
    let cancelled = false;

    if (pubkey && ndk) {
      setHydrating(false);
      return;
    }

    (async () => {
      // Priority 1: derived-mode vault — re-derive both keys via PRF.
      const blob = await vaultGet();
      if (blob?.kind === 'derived') {
        try {
          setHydrationLabel('biometric unlock…');
          const { nostrPrf, liquidPrf } = await assertPasskey(blob.credentialId);
          const { nsec, hex, npub } = deriveNsecFromPrf(nostrPrf);
          const mnemonic = deriveMnemonicFromPrf(liquidPrf);
          const ndkInst = await initNDK({ nsec });
          if (cancelled) return;
          setNdk(ndkInst);
          setIdentity(hex, npub);
          try {
            const adapter = await BreezAdapter.connect(mnemonic);
            useWalletStore.getState().setAdapter(adapter);
            useWalletStore.getState().setBalance(await adapter.getBalance());
          } catch (e) {
            console.warn('Breez hydrate failed', e);
          }
          if (!cancelled) setHydrating(false);
          return;
        } catch {
          if (!cancelled) router.replace('/login');
          return;
        }
      }

      // Priority 2: encrypted vault — biometric prompt to decrypt nsec.
      if (blob?.kind === 'encrypted') {
        try {
          setHydrationLabel('biometric unlock…');
          const payload = await unlockVault();
          const { hex, npub } = derivePubkeyFromNsec(payload.nsec);
          const ndkInst = await initNDK({ nsec: payload.nsec });
          if (cancelled) return;
          setNdk(ndkInst);
          setIdentity(hex, npub);
          if (payload.nwc) {
            try {
              const adapter = await NwcAdapter.connect(payload.nwc);
              useWalletStore.getState().setAdapter(adapter, { connectionString: payload.nwc });
              useWalletStore.getState().setBalance(await adapter.getBalance());
            } catch {}
          }
          if (!cancelled) setHydrating(false);
          return;
        } catch {
          if (!cancelled) router.replace('/login');
          return;
        }
      }

      // Priority 3: sessionStorage — temporary nsec or NIP-07 hint.
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
            const adapter = await NwcAdapter.connect(session.nwc);
            useWalletStore.getState().setAdapter(adapter, { connectionString: session.nwc });
            useWalletStore.getState().setBalance(await adapter.getBalance());
          } catch {}
        }

        if (!cancelled) setHydrating(false);
      } catch {
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
          <Loader2 className="w-4 h-4 animate-spin" /> {hydrationLabel}
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
