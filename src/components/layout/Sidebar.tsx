'use client';

import { useEffect, useState } from 'react';
import WalletPanel from '@/components/wallet/WalletPanel';
import ConnectWallet from '@/components/wallet/ConnectWallet';
import ReceiveInvoiceCard from '@/components/wallet/ReceiveInvoiceCard';
import SendCard from '@/components/wallet/SendCard';
import BackupPhraseCard from '@/components/wallet/BackupPhraseCard';
import ProfileEditor from '@/components/profile/ProfileEditor';
import ProfileView from '@/components/profile/ProfileView';
import { useWalletStore } from '@/store/useWalletStore';
import { useNostrStore } from '@/store/useNostrStore';
import { fetchProfiles } from '@/lib/nostr/events';
import { loadOwnProfile, saveOwnProfile } from '@/lib/nostr/profile-cache';
import { truncateNpub } from '@/lib/nostr/keys';
import { User, Copy, Check, UserPen } from 'lucide-react';

export default function Sidebar() {
  const { adapter } = useWalletStore();
  const { ndk, pubkey, npub, profile, setIdentity } = useNostrStore();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(false);

  /*
    Own-profile hydration. The login paths set identity without metadata,
    and a single relay fetch right after connect races the websocket
    handshakes — which looked like the profile "resetting" on refresh.
    The local cache answers instantly; the relays reconcile with retries.
  */
  useEffect(() => {
    let cancelled = false;
    if (!ndk || !pubkey || !npub || profile) return;
    const cached = loadOwnProfile(pubkey);
    if (cached) setIdentity(pubkey, npub, cached);
    (async () => {
      for (const delay of [1000, 6000, 15000]) {
        await new Promise((r) => setTimeout(r, delay));
        if (cancelled) return;
        const found: Record<string, import('@/types/nostr').NostrProfile> = await fetchProfiles(
          ndk,
          [pubkey]
        ).catch(() => ({}));
        const p = found[pubkey];
        if (p && (p.name || p.displayName || p.picture || p.lud16 || p.about)) {
          if (!cancelled) {
            setIdentity(pubkey, npub, p);
            saveOwnProfile(p);
          }
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ndk, pubkey, npub]);

  const copyNpub = async () => {
    if (!npub) return;
    try {
      await navigator.clipboard.writeText(npub);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const displayName = profile?.displayName || profile?.name;

  return (
    <div className="space-y-4">
      <div className="brut-panel p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => npub && setViewing(true)}
            aria-label="Open profile"
            className="flex items-center gap-3 min-w-0 flex-1 text-left"
          >
            {profile?.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.picture}
                alt=""
                className="w-12 h-12 border border-line rounded-xl object-cover shrink-0"
              />
            ) : (
              <div className="w-12 h-12 bg-orange flex items-center justify-center border border-line rounded-xl shrink-0">
                <User className="w-6 h-6 text-ink" strokeWidth={2.5} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] uppercase tracking-widest text-bone/50">Identity</div>
              {displayName ? (
                <div className="font-mono text-sm font-bold truncate">{displayName}</div>
              ) : null}
              <div className={`font-mono ${displayName ? 'text-[10px] text-bone/40' : 'text-sm'} truncate`}>
                {npub ? truncateNpub(npub, 10) : '—'}
              </div>
            </div>
          </button>
          {npub && (
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => setEditing((v) => !v)}
                aria-label="Edit profile"
                className="border border-line rounded-xl bg-panel p-1.5 hover:bg-orange hover:text-ink transition"
              >
                <UserPen className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={copyNpub}
                aria-label="Copy npub"
                className="border border-line rounded-xl bg-panel p-1.5 hover:bg-orange hover:text-ink transition"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
        {npub && !displayName && !editing ? (
          <button
            onClick={() => setEditing(true)}
            className="mt-3 w-full text-left font-mono text-[10px] text-orange hover:underline"
          >
            You appear as &quot;anon&quot; — set a name so people recognize you →
          </button>
        ) : null}
      </div>

      {editing ? <ProfileEditor onDone={() => setEditing(false)} /> : null}

      {adapter ? <WalletPanel /> : <ConnectWallet />}
      <ReceiveInvoiceCard />
      <SendCard />
      <BackupPhraseCard />

      {viewing ? (
        <ProfileView
          onClose={() => setViewing(false)}
          onEdit={() => {
            setViewing(false);
            setEditing(true);
          }}
        />
      ) : null}
    </div>
  );
}
