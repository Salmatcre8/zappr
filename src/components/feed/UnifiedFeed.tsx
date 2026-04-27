'use client';

import { useEffect, useState } from 'react';
import { useNostrStore } from '@/store/useNostrStore';
import { fetchFeed, fetchFollowList, fetchProfile } from '@/lib/nostr/events';
import NoteCard from './NoteCard';
import { Loader2, Radio, RefreshCw } from 'lucide-react';

export default function UnifiedFeed() {
  const {
    ndk, pubkey, feed, setFeed, follows, setFollows,
    loadingFeed, setLoadingFeed, upsertProfile, profiles,
  } = useNostrStore();
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!ndk || !pubkey) return;
    setLoadingFeed(true);
    try {
      let authors = follows;
      if (authors.length === 0) {
        authors = await fetchFollowList(ndk, pubkey);
        setFollows(authors);
      }
      // If user follows no one, show a sample relay-wide recent fallback
      const notes = authors.length
        ? await fetchFeed(ndk, authors, 40)
        : await fetchFeed(ndk, [pubkey], 20);
      setFeed(notes);
      // Fetch profiles for visible authors
      const uniqueAuthors = Array.from(new Set(notes.map((n) => n.pubkey)));
      uniqueAuthors.slice(0, 30).forEach(async (p) => {
        if (profiles[p]) return;
        const prof = await fetchProfile(ndk, p);
        if (prof) upsertProfile(prof);
      });
    } finally {
      setLoadingFeed(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ndk, pubkey]);

  const manualRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <div className="brut-panel h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-bone/60">
          <Radio className="w-3.5 h-3.5 text-volt" /> Unified Feed
        </div>
        <button
          onClick={manualRefresh}
          disabled={refreshing || loadingFeed}
          className="border-2 border-black bg-surface p-1.5 hover:bg-orange hover:text-ink transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loadingFeed ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loadingFeed && feed.length === 0 ? (
          <div className="flex items-center gap-2 justify-center py-12 font-mono text-xs text-bone/50">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading feed from relays…
          </div>
        ) : feed.length === 0 ? (
          <div className="py-12 text-center font-mono text-xs text-bone/50">
            No notes. Try following someone on Nostr first.
          </div>
        ) : (
          feed.map((note) => <NoteCard key={note.id} note={note} />)
        )}
      </div>
    </div>
  );
}
