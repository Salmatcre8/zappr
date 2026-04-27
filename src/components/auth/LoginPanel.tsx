'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Wallet, Shield, Loader2, Puzzle, Fingerprint } from 'lucide-react';
import { initNDK } from '@/lib/nostr/ndk';
import { derivePubkeyFromNsec } from '@/lib/nostr/keys';
import { connectNWC } from '@/lib/wallet/nwc';
import { getBalanceSats } from '@/lib/wallet/lightning';
import { useNostrStore } from '@/store/useNostrStore';
import { useWalletStore } from '@/store/useWalletStore';
import { saveSession } from '@/lib/auth/session';
import { vaultExists } from '@/lib/auth/vault';
import { unlockVault, isWebAuthnSupported } from '@/lib/auth/webauthn';

type Mode = 'idle' | 'nsec' | 'nip07' | 'biometric';

export default function LoginPanel() {
  const router = useRouter();
  const [nsec, setNsec] = useState('');
  const [nwc, setNwc] = useState('');
  const [mode, setMode] = useState<Mode>('idle');
  const [error, setError] = useState<string | null>(null);

  const [hasNip07, setHasNip07] = useState(false);
  const [hasVault, setHasVault] = useState(false);

  // Detect available login paths on the client only.
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as { nostr?: unknown }).nostr) {
      setHasNip07(true);
    }
    vaultExists().then(setHasVault).catch(() => {});
  }, []);

  async function hydrateWallet(connectionString: string) {
    try {
      const provider = await connectNWC(connectionString);
      useWalletStore.getState().setProvider(provider, connectionString);
      try {
        const bal = await getBalanceSats(provider);
        useWalletStore.getState().setBalance(bal);
      } catch {}
    } catch (e) {
      // Wallet connect failure shouldn't block login.
      console.warn('NWC connect failed', e);
    }
  }

  // ---- nsec path ----
  const handleNsecSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMode('nsec');
    try {
      if (!nsec.trim().startsWith('nsec1')) {
        throw new Error('Enter a valid nsec (starts with nsec1)');
      }
      const { hex, npub } = derivePubkeyFromNsec(nsec.trim());
      const ndk = await initNDK({ nsec: nsec.trim() });
      useNostrStore.getState().setNdk(ndk);
      useNostrStore.getState().setIdentity(hex, npub);
      if (nwc.trim()) await hydrateWallet(nwc.trim());

      saveSession({ nsec: nsec.trim(), nwc: nwc.trim() || null });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setMode('idle');
    }
  };

  // ---- NIP-07 path ----
  const handleNip07 = async () => {
    setError(null);
    setMode('nip07');
    try {
      const ndk = await initNDK({ useNip07: true });
      const signer = ndk.signer;
      if (!signer) throw new Error('NIP-07 signer unavailable');
      const user = await signer.user();
      const hex = user.pubkey;
      const npub = user.npub;
      useNostrStore.getState().setNdk(ndk);
      useNostrStore.getState().setIdentity(hex, npub);
      if (nwc.trim()) await hydrateWallet(nwc.trim());

      saveSession({ useNip07: true, nwc: nwc.trim() || null });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extension login failed');
      setMode('idle');
    }
  };

  // ---- biometric path ----
  const handleBiometric = async () => {
    setError(null);
    setMode('biometric');
    try {
      const payload = await unlockVault();
      const { hex, npub } = derivePubkeyFromNsec(payload.nsec);
      const ndk = await initNDK({ nsec: payload.nsec });
      useNostrStore.getState().setNdk(ndk);
      useNostrStore.getState().setIdentity(hex, npub);
      if (payload.nwc) await hydrateWallet(payload.nwc);

      // Vault is the source of truth — do NOT touch sessionStorage.
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Biometric unlock failed');
      setMode('idle');
    }
  };

  const busy = mode !== 'idle';

  return (
    <div className="brut-panel p-6 space-y-5">
      {/* Primary paths */}
      {(hasVault || hasNip07) && (
        <div className="space-y-2">
          {hasVault && (
            <button
              type="button"
              onClick={handleBiometric}
              disabled={busy}
              className="brut-btn w-full flex items-center justify-center gap-2"
            >
              {mode === 'biometric' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Fingerprint className="w-4 h-4" />
              )}
              {mode === 'biometric' ? 'Unlocking…' : 'Unlock with biometric'}
            </button>
          )}
          {hasNip07 && (
            <button
              type="button"
              onClick={handleNip07}
              disabled={busy}
              className="brut-btn-ghost w-full flex items-center justify-center gap-2"
            >
              {mode === 'nip07' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Puzzle className="w-4 h-4" />
              )}
              {mode === 'nip07' ? 'Connecting…' : 'Sign in with extension'}
            </button>
          )}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-[2px] bg-black" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-bone/50">
              or with nsec
            </span>
            <div className="flex-1 h-[2px] bg-black" />
          </div>
        </div>
      )}

      {/* nsec form */}
      <form onSubmit={handleNsecSubmit} className="space-y-5">
        <div>
          <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-bone/70 mb-2">
            <Key className="w-3.5 h-3.5" /> Nostr Key (nsec)
          </label>
          <input
            type="password"
            value={nsec}
            onChange={(e) => setNsec(e.target.value)}
            placeholder="nsec1..."
            className="brut-input"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div>
          <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-bone/70 mb-2">
            <Wallet className="w-3.5 h-3.5" /> NWC Connection (optional)
          </label>
          <input
            type="password"
            value={nwc}
            onChange={(e) => setNwc(e.target.value)}
            placeholder="nostr+walletconnect://..."
            className="brut-input"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-1 text-[10px] text-bone/40 font-mono">
            Grab one from Alby, Mutiny, Primal, or any NWC-compatible wallet.
          </p>
        </div>

        {error && (
          <div className="border-2 border-orange bg-orange/10 text-orange font-mono text-xs p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="brut-btn w-full flex items-center justify-center gap-2"
        >
          {mode === 'nsec' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {mode === 'nsec' ? 'Connecting…' : 'Enter zappr'}
        </button>
      </form>

      <div className="space-y-1.5 text-[11px] font-mono text-bone/50">
        <div className="flex items-start gap-2">
          <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Your nsec never leaves your browser. No server.</span>
        </div>
        <div className="flex items-start gap-2">
          <Fingerprint className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            {hasVault
              ? 'Biometric vault enrolled on this device.'
              : 'After login you can enroll a biometric vault for refresh-safe sessions.'}
          </span>
        </div>
      </div>
    </div>
  );
}

// Re-export so isWebAuthnSupported can be tree-shaken if unused elsewhere.
export { isWebAuthnSupported };
