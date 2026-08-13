'use client';

import { formatDistanceToNowStrict } from 'date-fns';
import { MessageCircle, Repeat2, Heart, Zap } from 'lucide-react';
import type { FeedNote } from '@/types/nostr';
import type { NoteEngagement } from '@/lib/nostr/events';
import { splitMedia } from '@/lib/nostr/note-media';
import { useNostrStore } from '@/store/useNostrStore';
import { truncateNpub, hexToNpub } from '@/lib/nostr/keys';
import ZapButton from './ZapButton';

function renderContent(text: string) {
  const parts = text.split(/(#\w+|https?:\/\/\S+)/g);
  return parts.map((p, i) => {
    if (/^#\w+/.test(p)) return <span key={i} className="text-orange">{p}</span>;
    if (/^https?:\/\//.test(p))
      return (
        <a key={i} href={p} target="_blank" rel="noreferrer" className="underline text-orange break-all">
          {p}
        </a>
      );
    return <span key={i}>{p}</span>;
  });
}

/*
  Engagement indicators (issue #13): small and tonal, not four bold chips.
  Counts are relay-local approximations — quiet styling is honest styling.
*/
function Indicator({
  icon: Icon,
  count,
  label,
}: {
  icon: typeof MessageCircle;
  count: number;
  label?: string;
}) {
  return (
    <span
      className={`flex items-center gap-1 font-mono text-[10px] ${
        count > 0 ? 'text-bone/60' : 'text-bone/25'
      }`}
    >
      <Icon className="w-3 h-3" />
      {label ?? (count > 0 ? count : '')}
    </span>
  );
}

export default function NoteCard({
  note,
  engagement,
  onOpen,
}: {
  note: FeedNote;
  engagement?: NoteEngagement;
  onOpen?: (note: FeedNote) => void;
}) {
  const profile = useNostrStore((s) => s.profiles[note.pubkey]);
  const name = profile?.displayName || profile?.name || 'anon';
  const npub = profile?.npub || hexToNpub(note.pubkey);
  const when = note.createdAt
    ? formatDistanceToNowStrict(new Date(note.createdAt * 1000)) + ' ago'
    : '';

  // Open the thread on card click — but never hijack links or buttons.
  const handleClick = (e: React.MouseEvent) => {
    if (!onOpen) return;
    if ((e.target as HTMLElement).closest('a,button,input')) return;
    onOpen(note);
  };

  return (
    <article
      onClick={handleClick}
      className={`bg-surface border border-line rounded-xl p-3 shadow-brut-sm ${
        onOpen ? 'cursor-pointer hover:border-orange/50 transition' : ''
      }`}
    >
      <header className="flex items-center gap-2 mb-2">
        {profile?.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.picture} alt="" className="w-8 h-8 border border-line rounded-xl object-cover" />
        ) : (
          <div className="w-8 h-8 bg-orange border border-line rounded-xl" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs font-bold truncate">{name}</div>
          <div className="font-mono text-[10px] text-bone/40 truncate">{truncateNpub(npub, 6)}</div>
        </div>
        <div className="font-mono text-[10px] text-bone/50 shrink-0">{when}</div>
      </header>
      {(() => {
        const { text, images } = splitMedia(note.content);
        return (
          <>
            {text ? (
              <div className="font-sans text-sm text-bone/90 whitespace-pre-wrap break-words">
                {renderContent(text)}
              </div>
            ) : null}
            {images.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                loading="lazy"
                className="mt-2 w-full max-h-80 object-cover border border-line rounded-xl"
              />
            ))}
          </>
        );
      })()}
      <footer className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onOpen ? (
            <button
              onClick={() => onOpen(note)}
              className="flex items-center gap-1 font-mono text-[10px] text-bone/60 hover:text-orange transition"
              aria-label="Open thread"
            >
              <MessageCircle className="w-3 h-3" />
              {engagement && engagement.replies > 0 ? engagement.replies : ''}
            </button>
          ) : (
            <Indicator icon={MessageCircle} count={engagement?.replies ?? 0} />
          )}
          <Indicator icon={Repeat2} count={engagement?.reposts ?? 0} />
          <Indicator icon={Heart} count={engagement?.reactions ?? 0} />
          <Indicator
            icon={Zap}
            count={engagement?.zaps ?? 0}
            label={
              engagement && engagement.zapSats > 0
                ? engagement.zapSats.toLocaleString()
                : engagement && engagement.zaps > 0
                  ? String(engagement.zaps)
                  : ''
            }
          />
        </div>
        <ZapButton targetPubkey={note.pubkey} eventId={note.id} lud16={profile?.lud16} />
      </footer>
    </article>
  );
}
