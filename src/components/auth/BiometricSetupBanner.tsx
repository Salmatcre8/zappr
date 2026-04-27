'use client';

import { useEffect, useState } from 'react';
import { Fingerprint, X, Loader2 } from 'lucide-react';
import { loadSession, clearSession } from '@/lib/auth/session';
import { vaultExists } from '@/lib/auth/vault';
import { enrollVault, isPrfLikelySupported } from '@/lib/auth/webauthn';

export default function BiometricSetupBanner() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = loadSession();
      if (!session?.nsec) return;
      if (await vaultExists()) return;
      if (!(await isPrfLikelySupported())) return;
      setVisible(true);
    })();
  }, []);

  if (!visible) return null;

  const enroll = async () => {
    setError(null);
    setBusy(true);
    try {
      const session = loadSession();
      if (!session?.nsec) throw new Error('No nsec in session');
      await enrollVault({ nsec: session.nsec, nwc: session.nwc ?? null });
      clearSession();
      setVisible(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enrollment failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-3 md:mx-4 mt-3 brut-panel p-3 flex items-center gap-3">
      <div className="w-8 h-8 bg-volt flex items-center justify-center border-2 border-black shrink-0">
        <Fingerprint className="w-4 h-4 text-ink" strokeWidth={3} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs font-bold uppercase tracking-wider">
          Enable biometric unlock
        </div>
        <div className="font-mono text-[10px] text-bone/60 mt-0.5">
          {error ?? 'Skip re-entering your nsec on refresh. Encrypted locally.'}
        </div>
      </div>
      <button
        onClick={enroll}
        disabled={busy}
        className="brut-btn text-xs px-3 py-1.5 flex items-center gap-1.5"
      >
        {busy && <Loader2 className="w-3 h-3 animate-spin" />}
        {busy ? 'Enrolling…' : 'Set up'}
      </button>
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="border-2 border-black bg-panel p-1.5 hover:bg-orange hover:text-ink transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
