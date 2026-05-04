'use client';

import { useEffect, useState } from 'react';
import { useNostrStore } from '@/store/useNostrStore';
import { fetchFeed, fetchFollowList, fetchProfile } from '@/lib/nostr/events';
import NoteCard from './NoteCard';
import FollowCard from './FollowCard';
import { Loader2, Radio, RefreshCw } from 'lucide-react';

export default function UnifiedFeed() {
  const {
    ndk, pubkey, feed, setFeed, follows, setFollows,
    loadingFeed, setLoadingFeed, upsertProfile, profiles,
  } = useNostrStore();
  const [refreshing, setRefreshing] = useState(false);

  const load = async (opts?: { useExistingFollows?: boolean }) => {
    if (!ndk || !pubkey) return;
    setLoadingFeed(true);
    try {
      let authors = follows;
      if (!opts?.useExistingFollows && authors.length === 0) {
        authors = await fetchFollowList(ndk, pubkey);
        setFollows(authors);
      }
      const notes = authors.length
        ? await fetchFeed(ndk, authors, 40)
        : [];
      setFeed(notes);
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
    await load({ useExistingFollows: true });
    setRefreshing(false);
  };

  const isEmpty = !loadingFeed && feed.length === 0;
  const noFollows = follows.length === 0;

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
        {/* Always-visible follow card when the user has zero follows;
            collapsed prompt otherwise. */}
        {noFollows ? (
          <FollowCard onChanged={manualRefresh} />
        ) : null}

        {loadingFeed && feed.length === 0 ? (
          <div className="flex items-center gap-2 justify-center py-12 font-mono text-xs text-bone/50">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading feed from relays…
          </div>
        ) : isEmpty ? (
          <div className="py-8 text-center font-mono text-xs text-bone/50 space-y-1">
            <div>Your feed is empty.</div>
            {!noFollows && <div>Try refreshing — relays can be slow.</div>}
          </div>
        ) : (
          <>
            {!noFollows && <FollowCard onChanged={manualRefresh} />}
            {feed.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
