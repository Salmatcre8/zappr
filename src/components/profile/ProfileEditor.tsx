'use client';

/*
  Profile editor — publishes kind:0 metadata so the user stops being "anon"
  across every Nostr client. Merges into the latest relay-side metadata to
  avoid wiping fields we don't manage (see publishProfile).

  The Lightning address (lud16) doubles as the zap target: without it,
  nobody can zap this user's notes.
*/

import { useState } from 'react';
import { Loader2, UserPen, Zap } from 'lucide-react';
import { publishProfile } from '@/lib/nostr/events';
import { saveOwnProfile } from '@/lib/nostr/profile-cache';
import { useNostrStore } from '@/store/useNostrStore';
import { useWalletStore } from '@/store/useWalletStore';
import type { SparkAdapter } from '@/lib/wallet/sparkAdapter';

export default function ProfileEditor({ onDone }: { onDone: () => void }) {
  const { ndk, pubkey, npub, profile, setIdentity, upsertProfile } = useNostrStore();
  const walletAdapter = useWalletStore((s) => s.adapter);
  const [name, setName] = useState(profile?.displayName || profile?.name || '');
  const [about, setAbout] = useState(profile?.about || '');
  const [picture, setPicture] = useState(profile?.picture || '');
  const [lud16, setLud16] = useState(profile?.lud16 || '');
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    The built-in Spark wallet can BE the zap target: the SDK registers a
    Lightning address (user@breez.tips) whose payments land directly in the
    Spark balance. One click fills it in as lud16.
  */
  const useZapprWallet = async () => {
    if (!walletAdapter || walletAdapter.kind !== 'spark' || linking) return;
    const spark = walletAdapter as SparkAdapter;
    setLinking(true);
    setError(null);
    try {
      let addr = await spark.lightningAddress();
      if (!addr) {
        const base =
          (name || npub?.slice(5, 13) || 'zappr')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 20) || 'zappr';
        try {
          addr = await spark.registerLightningAddress(base);
        } catch {
          addr = await spark.registerLightningAddress(
            `${base}${Math.floor(Math.random() * 900 + 100)}`
          );
        }
      }
      setLud16(addr);
    } catch {
      setError('Could not register a wallet address — try again.');
    } finally {
      setLinking(false);
    }
  };

  const save = async () => {
    if (!ndk || !pubkey || !npub || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await publishProfile(ndk, pubkey, {
        name: name.trim(),
        about: about.trim(),
        picture: picture.trim(),
        lud16: lud16.trim(),
      });
      setIdentity(pubkey, npub, updated);
      upsertProfile(updated);
      saveOwnProfile(updated);
      onDone();
    } catch {
      setError('Publish failed — relays may be slow, try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full bg-surface border border-line rounded-xl px-3 py-2 font-sans text-sm';
  const labelCls =
    'font-mono text-[10px] uppercase tracking-widest text-bone/50 mb-1 block';

  return (
    <div className="brut-panel p-4 space-y-3">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-bone/60">
        <UserPen className="w-3.5 h-3.5 text-orange" /> Edit profile
      </div>
      <div>
        <label className={labelCls}>Display name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="satoshi"
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>About</label>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="stacking sats in Lagos"
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </div>
      <div>
        <label className={labelCls}>Picture URL</label>
        <input
          value={picture}
          onChange={(e) => setPicture(e.target.value)}
          placeholder="https://…/me.jpg"
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Lightning address</label>
        <input
          value={lud16}
          onChange={(e) => setLud16(e.target.value)}
          placeholder="you@wallet.com"
          className={inputCls}
        />
        {walletAdapter?.kind === 'spark' ? (
          <button
            onClick={useZapprWallet}
            disabled={linking}
            className="mt-2 w-full flex items-center justify-center gap-1.5 border border-line rounded-xl bg-panel px-3 py-2 font-mono text-[11px] hover:bg-orange hover:text-ink transition disabled:opacity-60"
          >
            {linking ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Zap className="w-3 h-3 text-orange" />
            )}
            Use my zappr wallet
          </button>
        ) : null}
        <p className="font-mono text-[10px] text-bone/40 mt-1">
          {walletAdapter?.kind === 'spark'
            ? 'Zaps go to this address. The button above registers one that pays straight into your zappr wallet.'
            : 'Where zaps on your notes get paid. Without it nobody can zap you.'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 border border-line rounded-xl bg-orange text-ink px-3 py-2 font-mono text-[11px] font-bold disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Publish profile
        </button>
        <button
          onClick={onDone}
          disabled={saving}
          className="border border-line rounded-xl bg-panel px-3 py-2 font-mono text-[11px] hover:bg-surface transition"
        >
          Cancel
        </button>
      </div>
      {error ? <p className="font-mono text-[10px] text-orange">{error}</p> : null}
    </div>
  );
}
