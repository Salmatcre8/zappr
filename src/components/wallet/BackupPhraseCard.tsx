'use client';

import { useEffect, useState } from 'react';
import { Loader2, Eye, EyeOff, ShieldAlert, Copy, Check } from 'lucide-react';
import { vaultGet } from '@/lib/auth/vault';
import {
  assertPasskey,
  deriveMnemonicFromPrf,
} from '@/lib/auth/passkey-derive';

/**
 * Shown only when the user has a derived-mode vault (seedless wallet).
 * Re-prompts biometric, displays the BIP-39 mnemonic, lets them copy it.
 *
 * The mnemonic is the recovery path if the device's passkey is ever lost.
 * We never persist it — every reveal goes through PRF.
 */
export default function BackupPhraseCard() {
  const [available, setAvailable] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    vaultGet()
      .then((b) => setAvailable(b?.kind === 'derived'))
      .catch(() => {});
  }, []);

  if (!available) return null;

  const reveal = async () => {
    setError(null);
    setRevealing(true);
    try {
      const blob = await vaultGet();
      if (blob?.kind !== 'derived') throw new Error('Vault not in derived mode');
      const { liquidPrf } = await assertPasskey(blob.credentialId);
      setMnemonic(deriveMnemonicFromPrf(liquidPrf));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reveal failed');
    } finally {
      setRevealing(false);
    }
  };

  const copy = async () => {
    if (!mnemonic) return;
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const hide = () => {
    setMnemonic(null);
    setCopied(false);
  };

  return (
    <div className="brut-panel p-4 space-y-3">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-bone/60">
        <ShieldAlert className="w-3.5 h-3.5 text-volt" /> Recovery phrase
      </div>

      {!mnemonic ? (
        <>
          <p className="font-mono text-[10px] text-bone/50 leading-relaxed">
            Your wallet was created from your fingerprint. If this device is lost,
            this 12-word phrase is the only way to recover funds elsewhere. Reveal
            it once, write it down, store it offline.
          </p>
          <button
            onClick={reveal}
            disabled={revealing}
            className="brut-btn w-full flex items-center justify-center gap-2 text-xs"
          >
            {revealing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            {revealing ? 'Verifying…' : 'Reveal phrase'}
          </button>
          {error && <div className="font-mono text-[10px] text-orange">{error}</div>}
        </>
      ) : (
        <>
          <div className="bg-ink text-volt border-2 border-black p-3 font-mono text-[11px] leading-relaxed break-words">
            {mnemonic}
          </div>
          <div className="flex gap-2">
            <button
              onClick={copy}
              className="brut-btn-ghost flex-1 flex items-center justify-center gap-1.5 text-[11px]"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={hide}
              className="brut-btn-ghost flex-1 flex items-center justify-center gap-1.5 text-[11px]"
            >
              <EyeOff className="w-3 h-3" /> Hide
            </button>
          </div>
          <p className="font-mono text-[10px] text-orange leading-relaxed">
            Anyone with this phrase can drain your wallet. Don&apos;t paste it into
            websites, photos, or password managers you don&apos;t fully trust.
          </p>
        </>
      )}
    </div>
  );
}
