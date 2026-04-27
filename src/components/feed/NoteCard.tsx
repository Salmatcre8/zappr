'use client';

import { formatDistanceToNowStrict } from 'date-fns';
import type { FeedNote } from '@/types/nostr';
import { useNostrStore } from '@/store/useNostrStore';
import { truncateNpub, hexToNpub } from '@/lib/nostr/keys';
import ZapButton from './ZapButton';

function renderContent(text: string) {
  const parts = text.split(/(#\w+|https?:\/\/\S+)/g);
  return parts.map((p, i) => {
    if (/^#\w+/.test(p)) return <span key={i} className="text-orange">{p}</span>;
    if (/^https?:\/\//.test(p))
      return (
        <a key={i} href={p} target="_blank" rel="noreferrer" className="underline text-volt break-all">
          {p}
        </a>
      );
    return <span key={i}>{p}</span>;
  });
}

export default function NoteCard({ note }: { note: FeedNote }) {
  const profile = useNostrStore((s) => s.profiles[note.pubkey]);
  const name = profile?.displayName || profile?.name || 'anon';
  const npub = profile?.npub || hexToNpub(note.pubkey);
  const when = note.createdAt
    ? formatDistanceToNowStrict(new Date(note.createdAt * 1000)) + ' ago'
    : '';

  return (
    <article className="bg-surface border-2 border-black p-3 shadow-brut-sm">
      <header className="flex items-center gap-2 mb-2">
        {profile?.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.picture} alt="" className="w-8 h-8 border-2 border-black object-cover" />
        ) : (
          <div className="w-8 h-8 bg-orange border-2 border-black" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs font-bold truncate">{name}</div>
          <div className="font-mono text-[10px] text-bone/40 truncate">{truncateNpub(npub, 6)}</div>
        </div>
        <div className="font-mono text-[10px] text-bone/50 shrink-0">{when}</div>
      </header>
      <div className="font-sans text-sm text-bone/90 whitespace-pre-wrap break-words">
        {renderContent(note.content)}
      </div>
      <footer className="mt-3 flex items-center justify-end">
        <ZapButton targetPubkey={note.pubkey} eventId={note.id} lud16={profile?.lud16} />
      </footer>
    </article>
  );
}
