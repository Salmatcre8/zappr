'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Wallet, Shield, Loader2, Puzzle, Fingerprint, Sparkles } from 'lucide-react';
import { initNDK } from '@/lib/nostr/ndk';
import { derivePubkeyFromNsec } from '@/lib/nostr/keys';
import { NwcAdapter } from '@/lib/wallet/nwcAdapter';
import { BreezAdapter } from '@/lib/wallet/breezAdapter';
import { useNostrStore } from '@/store/useNostrStore';
import { useWalletStore } from '@/store/useWalletStore';
import { saveSession } from '@/lib/auth/session';
import { vaultGet } from '@/lib/auth/vault';
import {
  unlockVault,
  isWebAuthnSupported,
  enrollDerivedVault,
} from '@/lib/auth/webauthn';
import {
  createPasskey,
  assertPasskey,
  deriveNsecFromPrf,
  deriveMnemonicFromPrf,
} from '@/lib/auth/passkey-derive';

type Mode = 'idle' | 'nsec' | 'nip07' | 'biometric' | 'fresh';

export default function LoginPanel() {
  const router = useRouter();
  const [nsec, setNsec] = useState('');
  const [nwc, setNwc] = useState('');
  const [mode, setMode] = useState<Mode>('idle');
  const [error, setError] = useState<string | null>(null);

  const [hasNip07, setHasNip07] = useState(false);
  const [vaultKind, setVaultKind] = useState<'encrypted' | 'derived' | null>(null);
  const [breezEnabled, setBreezEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as { nostr?: unknown }).nostr) {
      setHasNip07(true);
    }
    vaultGet()
      .then((b) => setVaultKind(b?.kind ?? null))
      .catch(() => {});
    setBreezEnabled(!!process.env.NEXT_PUBLIC_BREEZ_API_KEY);
  }, []);

  async function hydrateNwc(connectionString: string) {
    try {
      const adapter = await NwcAdapter.connect(connectionString);
      useWalletStore.getState().setAdapter(adapter, { connectionString });
      try {
        useWalletStore.getState().setBalance(await adapter.getBalance());
      } catch {}
    } catch (e) {
      console.warn('NWC connect failed', e);
    }
  }

  async function hydrateBreez(mnemonic: string) {
    const adapter = await BreezAdapter.connect(mnemonic);
    useWalletStore.getState().setAdapter(adapter);
    try {
      useWalletStore.getState().setBalance(await adapter.getBalance());
    } catch {}
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
      if (nwc.trim()) await hydrateNwc(nwc.trim());

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
      useNostrStore.getState().setNdk(ndk);
      useNostrStore.getState().setIdentity(user.pubkey, user.npub);
      if (nwc.trim()) await hydrateNwc(nwc.trim());

      saveSession({ useNip07: true, nwc: nwc.trim() || null });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extension login failed');
      setMode('idle');
    }
  };

  // ---- biometric unlock — routes by vault kind ----
  const handleBiometric = async () => {
    setError(null);
    setMode('biometric');
    try {
      const blob = await vaultGet();
      if (!blob) throw new Error('No vault enrolled');

      if (blob.kind === 'encrypted') {
        const payload = await unlockVault();
        const { hex, npub } = derivePubkeyFromNsec(payload.nsec);
        const ndk = await initNDK({ nsec: payload.nsec });
        useNostrStore.getState().setNdk(ndk);
        useNostrStore.getState().setIdentity(hex, npub);
        if (payload.nwc) await hydrateNwc(payload.nwc);
        router.push('/dashboard');
        return;
      }

      // Derived mode: re-derive both keys via PRF.
      const { nostrPrf, liquidPrf } = await assertPasskey(blob.credentialId);
      const { nsec: derivedNsec, hex, npub } = deriveNsecFromPrf(nostrPrf);
      const mnemonic = deriveMnemonicFromPrf(liquidPrf);

      const ndk = await initNDK({ nsec: derivedNsec });
      useNostrStore.getState().setNdk(ndk);
      useNostrStore.getState().setIdentity(hex, npub);

      try {
        await hydrateBreez(mnemonic);
      } catch (e) {
        console.warn('Breez hydrate failed', e);
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Biometric unlock failed');
      setMode('idle');
    }
  };

  // ---- "Start fresh" — seedless passkey wallet ----
  const handleStartFresh = async () => {
    setError(null);
    setMode('fresh');
    try {
      if (!breezEnabled) {
        throw new Error('Seedless wallet unavailable — Breez API key not configured');
      }
      if (!isWebAuthnSupported()) {
        throw new Error('WebAuthn not supported on this device');
      }

      const { credentialId, nostrPrf, liquidPrf } = await createPasskey('zappr account');
      const { nsec: freshNsec, hex, npub } = deriveNsecFromPrf(nostrPrf);
      const mnemonic = deriveMnemonicFromPrf(liquidPrf);

      const ndk = await initNDK({ nsec: freshNsec });
      useNostrStore.getState().setNdk(ndk);
      useNostrStore.getState().setIdentity(hex, npub);

      await hydrateBreez(mnemonic);
      await enrollDerivedVault(credentialId);
      // No sessionStorage — vault is the source of truth.
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create wallet');
      setMode('idle');
    }
  };

  const busy = mode !== 'idle';
  const hasVault = vaultKind !== null;

  return (
    <div className="brut-panel p-6 space-y-5">
      {/* "Start fresh" — beginner path. Always at the top when available. */}
      {breezEnabled && !hasVault && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleStartFresh}
            disabled={busy}
            className="brut-btn w-full flex items-center justify-center gap-2 bg-volt text-ink"
          >
            {mode === 'fresh' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {mode === 'fresh' ? 'Creating wallet…' : 'Create with FaceID / Fingerprint'}
          </button>
          <p className="text-[10px] font-mono text-bone/50 leading-relaxed">
            New to Bitcoin? One tap creates a self-custodial Lightning wallet and
            Nostr identity. No seed phrase. No keys to copy.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-[2px] bg-black" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-bone/50">
              already have a wallet?
            </span>
            <div className="flex-1 h-[2px] bg-black" />
          </div>
        </div>
      )}

      {/* Existing user paths */}
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
          <span>Your keys never leave your browser. No server.</span>
        </div>
        <div className="flex items-start gap-2">
          <Fingerprint className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            {hasVault
              ? 'Biometric vault enrolled on this device.'
              : breezEnabled
                ? 'Tap above to create a wallet from your fingerprint — no seed phrase needed.'
                : 'After login you can enroll biometrics for refresh-safe sessions.'}
          </span>
        </div>
      </div>
    </div>
  );
}

export { isWebAuthnSupported };
