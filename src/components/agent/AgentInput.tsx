'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { useAgentStore } from '@/store/useAgentStore';

export default function AgentInput({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const busy = useAgentStore((s) => s.busy);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    onSend(text);
    setText('');
  };

  return (
    <form onSubmit={submit} className="border-t-2 border-black p-3 flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={busy ? 'Working…' : 'Ask the agent…'}
        disabled={busy}
        className="flex-1 bg-surface border-2 border-black px-3 py-2 font-mono text-xs disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="border-2 border-black bg-orange text-ink px-3 disabled:opacity-50 hover:-translate-x-[1px] hover:-translate-y-[1px] transition"
      >
        <Send className="w-4 h-4" strokeWidth={2.5} />
      </button>
    </form>
  );
}
