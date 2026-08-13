'use client';

/*
  Note thread view (issue #14): overlay inside the app shell showing a note,
  its replies from the connected relays, a reply composer, and a like action.
  Replies and likes publish immediately (they're cheap); zaps keep the
  confirm-before-send flow via ZapButton.
*/

import { useEffect, useRef, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Heart, Loader2, MessageCircle, Repeat2, Send, X } from 'lucide-react';
import type { FeedNote } from '@/types/nostr';
import {
  fetchMyEngagement,
  fetchProfiles,
  fetchReplies,
  publishReaction,
  publishReply,
  publishRepost,
} from '@/lib/nostr/events';
import { addMark, loadMarks } from '@/lib/nostr/engage-cache';
import { splitMedia } from '@/lib/nostr/note-media';
import { useNostrStore } from '@/store/useNostrStore';
import { truncateNpub, hexToNpub } from '@/lib/nostr/keys';
import NoteCard from './NoteCard';

function ReplyRow({ reply }: { reply: FeedNote }) {
  const profile = useNostrStore((s) => s.profiles[reply.pubkey]);
  const name = profile?.displayName || profile?.name || 'anon';
  const npub = profile?.npub || hexToNpub(reply.pubkey);
  const when = reply.createdAt
    ? formatDistanceToNowStrict(new Date(reply.createdAt * 1000)) + ' ago'
    : '';
  return (
    <div className="border-l-2 border-line pl-3 py-2">
      <div className="flex items-baseline gap-2 mb-0.5">
        <span className="font-mono text-xs font-bold truncate">{name}</span>
        <span className="font-mono text-[10px] text-bone/40 truncate">{truncateNpub(npub, 6)}</span>
        <span className="font-mono text-[10px] text-bone/40 ml-auto shrink-0">{when}</span>
      </div>
      {(() => {
        const { text, images } = splitMedia(reply.content);
        return (
          <>
            {text ? (
              <div className="font-sans text-sm text-bone/90 whitespace-pre-wrap break-words">
                {text}
              </div>
            ) : null}
            {images.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                loading="lazy"
                className="mt-1.5 w-full max-h-64 object-cover border border-line rounded-xl"
              />
            ))}
          </>
        );
      })()}
    </div>
  );
}

export default function NoteThread({
  note,
  onClose,
}: {
  note: FeedNote;
  onClose: () => void;
}) {
  const { ndk, pubkey, profiles, upsertProfile } = useNostrStore();
  const [replies, setReplies] = useState<FeedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [reposting, setReposting] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  // Like/Repost state must survive closing the thread: local cache answers
  // instantly, then the relays confirm (covers likes from other devices).
  useEffect(() => {
    let cancelled = false;
    if (loadMarks('liked').has(note.id)) setLiked(true);
    if (loadMarks('reposted').has(note.id)) setReposted(true);
    if (ndk && pubkey) {
      fetchMyEngagement(ndk, pubkey, note.id)
        .then((mine) => {
          if (cancelled) return;
          if (mine.liked) setLiked(true);
          if (mine.reposted) setReposted(true);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ndk, pubkey, note.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ndk) return;
      setLoading(true);
      setError(null);
      try {
        const found = await fetchReplies(ndk, note.id);
        if (cancelled) return;
        setReplies(found);
        // Profiles are cosmetic — one batched kind:0 fetch in the background.
        const missing = Array.from(new Set(found.map((r) => r.pubkey))).filter(
          (p) => !profiles[p]
        );
        if (missing.length) {
          fetchProfiles(ndk, missing)
            .then((profs) => {
              if (!cancelled) Object.values(profs).forEach(upsertProfile);
            })
            .catch(() => {});
        }
      } catch {
        if (!cancelled) setError('Could not load replies — relays can be slow. Try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ndk, note.id]);

  const sendReply = async () => {
    if (!ndk || !pubkey || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const id = await publishReply(ndk, note, draft.trim());
      // Optimistic append — other clients will see it via the relays.
      setReplies((r) => [
        ...r,
        {
          id,
          pubkey,
          content: draft.trim(),
          createdAt: Math.floor(Date.now() / 1000),
          tags: [],
        },
      ]);
      setDraft('');
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch {
      setError('Reply failed to publish — try again.');
    } finally {
      setSending(false);
    }
  };

  const like = async () => {
    if (!ndk || !pubkey || liked || liking) return;
    setLiking(true);
    try {
      await publishReaction(ndk, note);
      setLiked(true);
      addMark('liked', note.id);
    } catch {
      setError('Reaction failed to publish — try again.');
    } finally {
      setLiking(false);
    }
  };

  const repost = async () => {
    if (!ndk || !pubkey || reposted || reposting) return;
    setReposting(true);
    try {
      await publishRepost(ndk, note);
      setReposted(true);
      addMark('reposted', note.id);
    } catch {
      setError('Repost failed to publish — try again.');
    } finally {
      setReposting(false);
    }
  };

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
            <MessageCircle className="w-3.5 h-3.5 text-orange" /> Thread
          </div>
          <button
            onClick={onClose}
            aria-label="Close thread"
            className="border border-line rounded-xl bg-surface p-1.5 hover:bg-orange hover:text-ink transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <NoteCard note={note} />

          <div className="flex items-center gap-2">
            <button
              onClick={like}
              disabled={!pubkey || liked || liking}
              className={`flex items-center gap-1 border border-line rounded-xl px-2 py-1 font-mono text-[11px] transition ${
                liked
                  ? 'bg-orange text-ink'
                  : 'bg-panel hover:bg-orange hover:text-ink disabled:opacity-50'
              }`}
            >
              {liking ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Heart className={`w-3 h-3 ${liked ? 'fill-current' : ''}`} />
              )}
              {liked ? 'Liked' : 'Like'}
            </button>
            <button
              onClick={repost}
              disabled={!pubkey || reposted || reposting}
              className={`flex items-center gap-1 border border-line rounded-xl px-2 py-1 font-mono text-[11px] transition ${
                reposted
                  ? 'bg-orange text-ink'
                  : 'bg-panel hover:bg-orange hover:text-ink disabled:opacity-50'
              }`}
            >
              {reposting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Repeat2 className="w-3 h-3" />
              )}
              {reposted ? 'Reposted' : 'Repost'}
            </button>
            <span className="font-mono text-[10px] text-bone/40">
              {replies.length > 0
                ? `${replies.length} repl${replies.length === 1 ? 'y' : 'ies'} on your relays`
                : ''}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 justify-center py-8 font-mono text-xs text-bone/50">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading replies…
            </div>
          ) : replies.length === 0 ? (
            <div className="py-6 text-center font-mono text-xs text-bone/50">
              No replies yet — start the conversation.
            </div>
          ) : (
            <div className="space-y-1">
              {replies.map((r) => (
                <ReplyRow key={r.id} reply={r} />
              ))}
            </div>
          )}
          <div ref={listEndRef} />
        </div>

        <div className="border-t-2 border-line p-3">
          {pubkey ? (
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a reply…"
                rows={2}
                className="flex-1 bg-surface border border-line rounded-xl px-3 py-2 font-sans text-sm resize-none"
              />
              <button
                onClick={sendReply}
                disabled={sending || !draft.trim()}
                className="flex items-center gap-1 border border-line rounded-xl bg-orange text-ink px-3 py-2 font-mono text-[11px] disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Reply
              </button>
            </div>
          ) : (
            <div className="font-mono text-[11px] text-bone/50 text-center py-1">
              Log in to reply and like.
            </div>
          )}
          {error ? (
            <div className="font-mono text-[10px] text-orange mt-2">{error}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
