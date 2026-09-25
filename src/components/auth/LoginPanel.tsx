'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Wallet, Shield, Loader2, Puzzle, Fingerprint, Sparkles } from 'lucide-react';
import { initNDK } from '@/lib/nostr/ndk';
import { derivePubkeyFromNsec } from '@/lib/nostr/keys';
import { NwcAdapter } from '@/lib/wallet/nwcAdapter';
import { SparkAdapter } from '@/lib/wallet/sparkAdapter';
import { useNostrStore } from '@/store/useNostrStore';
import { useWalletStore } from '@/store/useWalletStore';
import { saveSession } from '@/lib/auth/session';
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { nip19, generateSecretKey } from 'nostr-tools';
import { vaultGet } from '@/lib/auth/vault';
import {
  unlockVault,
  isWebAuthnSupported,
  enrollDerivedVault,
  assertDerivedIdentity,
} from '@/lib/auth/webauthn';
import {
  createPasskey,
  assertPasskey,
  discoverPasskey,
  deriveNsecFromPrf,
  deriveMnemonicFromPrf,
} from '@/lib/auth/passkey-derive';

type Mode = 'idle' | 'nsec' | 'nip07' | 'biometric' | 'fresh' | 'recover' | 'restore';

export default function LoginPanel() {
  const router = useRouter();
  const [nsec, setNsec] = useState('');
  const [showRestore, setShowRestore] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [restoreNsec, setRestoreNsec] = useState('');
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
      /*
        Publish it to the identity's own NIP-78 record so the next device
        inherits the wallet instead of asking for the string again (issue 2).
        Runs after the store is populated, and never blocks login.
      */
      const { ndk, pubkey } = useNostrStore.getState();
      if (ndk && pubkey) {
        const { publishNwc } = await import('@/lib/nostr/app-data');
        void publishNwc(ndk, pubkey, connectionString).catch(() => {});
      }
      try {
        useWalletStore.getState().setBalance(await adapter.getBalance());
      } catch {}
    } catch (e) {
      console.warn('NWC connect failed', e);
    }
  }

  async function hydrateBreez(mnemonic: string) {
    const adapter = await SparkAdapter.connect(mnemonic);
    useWalletStore.getState().setAdapter(adapter);
    try {
      useWalletStore.getState().setBalance(await adapter.getBalance());
    } catch {}
  }

  /*
    Restore from recovery phrase — the escape hatch for a lost passkey.

    The 12 words seed the WALLET only; the Nostr key comes from a different PRF
    salt and is not in the phrase. So this recovers funds, and takes an nsec
    separately if the user still has one. Deliberately session-only: nothing is
    written to storage, because a seed phrase sitting in sessionStorage is a
    worse trade than asking for it again. Get in, move the sats, done.
  */
  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMode('restore');
    try {
      const words = phrase.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!validateMnemonic(words.join(' '), wordlist)) {
        throw new Error(
          `That recovery phrase isn't valid (${words.length} words read). Check the spelling and order.`
        );
      }
      const mnemonic = words.join(' ');

      // Identity: the user's own nsec when they have it, otherwise a fresh key
      // so the app can run. Their old npub stays with the old passkey.
      const typed = restoreNsec.trim();
      if (typed && !typed.startsWith('nsec1')) {
        throw new Error('That nsec looks wrong (it should start with nsec1). Leave it blank to skip.');
      }
      const identityNsec = typed || nip19.nsecEncode(generateSecretKey());
      const { hex, npub } = derivePubkeyFromNsec(identityNsec);

      const ndk = await initNDK({ nsec: identityNsec });
      useNostrStore.getState().setNdk(ndk);
      useNostrStore.getState().setIdentity(hex, npub);

      // The whole point — get the wallet back.
      await hydrateBreez(mnemonic);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
      setMode('idle');
    }
  };

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
      // Refuse to sign in as anyone but the account this vault was enrolled with.
      assertDerivedIdentity(blob, npub);
      const mnemonic = deriveMnemonicFromPrf(liquidPrf);

      const ndk = await initNDK({ nsec: derivedNsec });
      useNostrStore.getState().setNdk(ndk);
      useNostrStore.getState().setIdentity(hex, npub);

      try {
        await hydrateBreez(mnemonic);
      } catch (e) {
        console.warn('Breez hydrate failed', e);
      }
      // Backfill for vaults enrolled before the identity check existed.
      if (!blob.npub) await enrollDerivedVault(blob.credentialId, npub);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Biometric unlock failed');
      setMode('idle');
    }
  };

  // ---- Recover existing passkey wallet (no vault required) ----
  const handleRecover = async () => {
    setError(null);
    setMode('recover');
    try {
      if (!breezEnabled) {
        throw new Error('Seedless wallet unavailable — Breez API key not configured');
      }
      if (!isWebAuthnSupported()) {
        throw new Error('WebAuthn not supported on this device');
      }
      const { credentialId, nostrPrf, liquidPrf } = await discoverPasskey();
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
      /*
        A vault may already exist on this device (e.g. the user is re-running
        recovery). If it does, the discovered passkey must produce the same
        account — otherwise they picked a different zappr passkey and we would
        overwrite the good credential id with the wrong one.
      */
      const existing = await vaultGet();
      if (existing?.kind === 'derived') assertDerivedIdentity(existing, npub);
      // Re-store credential id so future unlocks use the fast path.
      await enrollDerivedVault(credentialId, npub);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recovery failed');
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
      // Record the identity this passkey produces, so a later unlock that
      // derives something different fails loudly instead of silently.
      await enrollDerivedVault(credentialId, npub);
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
            className="brut-btn w-full flex items-center justify-center gap-2 bg-orange text-ink"
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

          <button
            type="button"
            onClick={handleRecover}
            disabled={busy}
            className="brut-btn-ghost w-full flex items-center justify-center gap-2"
          >
            {mode === 'recover' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Fingerprint className="w-4 h-4" />
            )}
            {mode === 'recover' ? 'Recovering…' : 'I already have a passkey wallet'}
          </button>
          <p className="text-[10px] font-mono text-bone/50 leading-relaxed">
            Made one before on this device? Recover with your fingerprint — no
            seed phrase needed.
          </p>

          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-[2px] bg-black" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-bone/50">
              or use an existing identity
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

      {/* Lost-passkey escape hatch. Collapsed by default — it is a recovery
          route, not a login route, and should not compete with the main paths. */}
      <div className="mt-5">
        {!showRestore ? (
          <button
            type="button"
            onClick={() => setShowRestore(true)}
            className="font-mono text-[11px] uppercase tracking-widest text-bone/50 hover:text-orange transition"
          >
            Lost your passkey? Restore from recovery phrase →
          </button>
        ) : (
          <form onSubmit={handleRestore} className="brut-panel p-4 space-y-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-orange">
              Restore from recovery phrase
            </div>
            <div>
              <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-bone/70 mb-2">
                <Key className="w-3.5 h-3.5" /> Your 12 words
              </label>
              <textarea
                rows={3}
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder="witch collapse practice feed shame open despair creek road again ice least"
                className="brut-input text-[11px]"
              />
              <p className="font-mono text-[10px] text-bone/50 leading-relaxed mt-2">
                This restores your <span className="text-bone/80">wallet</span>. Your Nostr key is
                not in the phrase — add it below if you still have it, or leave it blank and get a
                new one. Nothing is saved to this browser, so you will need the phrase again next
                time.
              </p>
            </div>
            <div>
              <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-bone/70 mb-2">
                <Key className="w-3.5 h-3.5" /> Nostr key (optional)
              </label>
              <input
                type="password"
                value={restoreNsec}
                onChange={(e) => setRestoreNsec(e.target.value)}
                placeholder="nsec1…"
                className="brut-input"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={mode !== 'idle' || !phrase.trim()}
                className="brut-btn flex-1 flex items-center justify-center gap-2"
              >
                {mode === 'restore' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {mode === 'restore' ? 'Restoring…' : 'Restore wallet'}
              </button>
              <button
                type="button"
                onClick={() => setShowRestore(false)}
                className="brut-btn-ghost"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

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
          <div className="border border-orange bg-orange/10 text-orange font-mono text-xs p-3">
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
