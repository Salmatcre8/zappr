'use client';

import { useState } from 'react';
import { UserPlus, Loader2, Check, AlertCircle } from 'lucide-react';
import { useNostrStore } from '@/store/useNostrStore';
import { publishContacts } from '@/lib/nostr/events';
import { npubToHex } from '@/lib/nostr/keys';

type Suggested = {
  label: string;
  npub: string;
};

// A few well-known npubs to seed empty accounts. These are stable identities;
// the chips give brand-new users *something* to follow on day one.
const SUGGESTED: Suggested[] = [
  { label: 'fiatjaf (creator of Nostr)', npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6' },
  { label: 'jack', npub: 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m' },
  { label: 'jb55 (Damus)', npub: 'npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s' },
  { label: 'odell (Bitcoin podcaster)', npub: 'npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx' },
  { label: 'PABLOF7z (NDK author)', npub: 'npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft' },
];

export default function FollowCard({ onChanged }: { onChanged?: () => void }) {
  const { ndk, follows, setFollows } = useNostrStore();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuggested, setShowSuggested] = useState(false);

  const followOne = async (raw: string) => {
    if (!ndk) {
      setError('Not connected');
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const trimmed = raw.trim();
      let hex: string;
      if (trimmed.startsWith('npub1')) {
        hex = npubToHex(trimmed);
      } else if (/^[0-9a-f]{64}$/i.test(trimmed)) {
        hex = trimmed.toLowerCase();
      } else {
        throw new Error('Paste an npub or 64-char hex pubkey');
      }
      if (follows.includes(hex)) {
        setOkMsg('Already following');
        return;
      }
      const next = Array.from(new Set([...follows, hex]));
      await publishContacts(ndk, next);
      setFollows(next);
      setInput('');
      setOkMsg('Followed. Refreshing feed…');
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Follow failed');
    } finally {
      setBusy(false);
      setTimeout(() => setOkMsg(null), 2500);
    }
  };

  return (
    <div className="brut-panel p-3 space-y-2">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-bone/60">
        <UserPlus className="w-3.5 h-3.5 text-volt" /> Follow someone
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="npub1…"
          className="brut-input text-xs flex-1"
          disabled={busy}
        />
        <button
          onClick={() => followOne(input)}
          disabled={busy || !input.trim()}
          className="brut-btn px-3 text-xs flex items-center gap-1.5"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
          Follow
        </button>
      </div>

      {error && (
        <div className="font-mono text-[10px] text-orange flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </div>
      )}
      {okMsg && (
        <div className="font-mono text-[10px] text-volt flex items-center gap-1">
          <Check className="w-3 h-3" /> {okMsg}
        </div>
      )}

      <button
        onClick={() => setShowSuggested((v) => !v)}
        className="font-mono text-[10px] text-bone/50 hover:text-orange transition"
      >
        {showSuggested ? '− hide suggestions' : '+ suggested follows'}
      </button>

      {showSuggested && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {SUGGESTED.map((s) => {
            let alreadyFollowing = false;
            try {
              alreadyFollowing = follows.includes(npubToHex(s.npub));
            } catch {}
            return (
              <button
                key={s.npub}
                onClick={() => followOne(s.npub)}
                disabled={busy || alreadyFollowing}
                className={`border-2 border-black px-2 py-1 font-mono text-[10px] transition ${
                  alreadyFollowing
                    ? 'bg-volt text-ink opacity-70'
                    : 'bg-panel hover:bg-orange hover:text-ink'
                }`}
              >
                {alreadyFollowing ? '✓ ' : '+ '}{s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
