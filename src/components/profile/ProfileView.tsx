'use client';

/*
  Profile page: who you are on Nostr plus what you've engaged with — your
  posts, the notes you liked, and the ones you reposted. Opened from the
  sidebar identity card; same in-shell overlay pattern as NoteThread.
*/

import { useEffect, useState } from 'react';
import { Loader2, User, UserPen, X } from 'lucide-react';
import type { FeedNote } from '@/types/nostr';
import { fetchEngagedNotes, fetchFeed, fetchProfile } from '@/lib/nostr/events';
import { truncateNpub } from '@/lib/nostr/keys';
import { useNostrStore } from '@/store/useNostrStore';
import NoteCard from '@/components/feed/NoteCard';
import NoteThread from '@/components/feed/NoteThread';

type Tab = 'posts' | 'likes' | 'reposts';
const TABS: { key: Tab; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'likes', label: 'Likes' },
  { key: 'reposts', label: 'Reposts' },
];

export default function ProfileView({
  onClose,
  onEdit,
}: {
  onClose: () => void;
  onEdit: () => void;
}) {
  const { ndk, pubkey, npub, profile, profiles, upsertProfile } = useNostrStore();
  const [tab, setTab] = useState<Tab>('posts');
  const [notes, setNotes] = useState<Record<Tab, FeedNote[] | null>>({
    posts: null,
    likes: null,
    reposts: null,
  });
  const [loading, setLoading] = useState(false);
  const [openNote, setOpenNote] = useState<FeedNote | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ndk || !pubkey || notes[tab] !== null) return;
      setLoading(true);
      try {
        const found =
          tab === 'posts'
            ? await fetchFeed(ndk, [pubkey], 30)
            : await fetchEngagedNotes(ndk, pubkey, tab === 'likes' ? 7 : 6, 30);
        if (cancelled) return;
        setNotes((n) => ({ ...n, [tab]: found }));
        Array.from(new Set(found.map((n) => n.pubkey)))
          .slice(0, 20)
          .forEach(async (p) => {
            if (profiles[p]) return;
            const prof = await fetchProfile(ndk, p);
            if (prof && !cancelled) upsertProfile(prof);
          });
      } catch {
        if (!cancelled) setNotes((n) => ({ ...n, [tab]: n[tab] ?? [] }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ndk, pubkey, tab]);

  if (!pubkey || !npub) return null;

  const name = profile?.displayName || profile?.name;
  const current = notes[tab];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-ink/60" onClick={onClose} />
      <div className="brut-panel relative w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-line">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-bone/60">
            <User className="w-3.5 h-3.5 text-orange" /> Profile
          </div>
          <button
            onClick={onClose}
            aria-label="Close profile"
            className="border border-line rounded-xl bg-surface p-1.5 hover:bg-orange hover:text-ink transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-3">
            {profile?.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.picture}
                alt=""
                className="w-16 h-16 border border-line rounded-xl object-cover shrink-0"
              />
            ) : (
              <div className="w-16 h-16 bg-orange flex items-center justify-center border border-line rounded-xl shrink-0">
                <User className="w-8 h-8 text-ink" strokeWidth={2.5} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-mono text-lg font-bold truncate">{name || 'anon'}</div>
              <div className="font-mono text-[10px] text-bone/40 truncate">
                {truncateNpub(npub, 10)}
              </div>
              {profile?.lud16 ? (
                <div className="font-mono text-[10px] text-orange truncate">⚡ {profile.lud16}</div>
              ) : null}
            </div>
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 border border-line rounded-xl bg-panel px-3 py-2 font-mono text-[11px] hover:bg-orange hover:text-ink transition shrink-0"
            >
              <UserPen className="w-3 h-3" /> Edit
            </button>
          </div>

          {profile?.about ? (
            <p className="font-sans text-sm text-bone/80 whitespace-pre-wrap">{profile.about}</p>
          ) : null}

          <div className="flex gap-2">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`border rounded-xl px-3 py-1.5 font-mono text-[11px] transition ${
                  tab === key
                    ? 'bg-orange text-ink border-transparent font-bold'
                    : 'bg-panel border-line hover:bg-surface'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading || current === null ? (
            <div className="flex items-center gap-2 justify-center py-8 font-mono text-xs text-bone/50">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : current.length === 0 ? (
            <div className="py-6 text-center font-mono text-xs text-bone/50">
              {tab === 'posts'
                ? 'No posts yet.'
                : tab === 'likes'
                  ? 'Notes you like will appear here.'
                  : 'Notes you repost will appear here.'}
            </div>
          ) : (
            <div className="space-y-3">
              {current.map((note) => (
                <NoteCard key={note.id} note={note} onOpen={setOpenNote} />
              ))}
            </div>
          )}
        </div>
      </div>

      {openNote ? <NoteThread note={openNote} onClose={() => setOpenNote(null)} /> : null}
    </div>
  );
}
