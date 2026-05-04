'use client';

import { useEffect, useState } from 'react';
import { useNostrStore } from '@/store/useNostrStore';
import { fetchFeed, fetchFollowList, fetchProfile } from '@/lib/nostr/events';
import { loadFollows, saveFollows } from '@/lib/nostr/follow-cache';
import NoteCard from './NoteCard';
import FollowCard from './FollowCard';
import { Loader2, Radio, RefreshCw } from 'lucide-react';

export default function UnifiedFeed() {
  const {
    ndk, pubkey, feed, setFeed, follows, setFollows,
    loadingFeed, setLoadingFeed, upsertProfile, profiles,
  } = useNostrStore();
  const [refreshing, setRefreshing] = useState(false);

  // Resolve which authors to fetch the feed for: prefer in-memory follows,
  // then the local cache, then a relay-side kind:3 fetch. We always kick off
  // a background relay reconciliation so other-client follows surface within
  // seconds, but we never block the UI on it.
  const resolveAuthors = async (): Promise<string[]> => {
    if (!ndk || !pubkey) return [];
    if (follows.length > 0) {
      reconcileFollowsInBackground();
      return follows;
    }
    const cached = loadFollows(pubkey);
    if (cached && cached.follows.length > 0) {
      setFollows(cached.follows);
      reconcileFollowsInBackground(cached.eventCreatedAt);
      return cached.follows;
    }
    const fresh = await fetchFollowList(ndk, pubkey);
    if (fresh) {
      setFollows(fresh.follows);
      saveFollows(pubkey, fresh.follows, fresh.createdAt);
      return fresh.follows;
    }
    return [];
  };

  // Fire-and-forget. Replaces the in-memory + cached follow list only if the
  // relay returns a kind:3 event newer than what we already have.
  const reconcileFollowsInBackground = (knownCreatedAt?: number) => {
    if (!ndk || !pubkey) return;
    fetchFollowList(ndk, pubkey)
      .then((res) => {
        if (!res) return;
        if (knownCreatedAt && res.createdAt <= knownCreatedAt) return;
        setFollows(res.follows);
        saveFollows(pubkey, res.follows, res.createdAt);
      })
      .catch(() => {});
  };

  const load = async () => {
    if (!ndk || !pubkey) return;
    setLoadingFeed(true);
    try {
      const authors = await resolveAuthors();
      const notes = authors.length ? await fetchFeed(ndk, authors, 40) : [];
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
    await load();
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
        {noFollows ? <FollowCard onChanged={manualRefresh} /> : null}

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
