'use client';

import type { AgentMessage as Msg } from '@/types/agent';

/*
  Minimal inline-Markdown rendering for agent replies: **bold**, *italic*,
  `code`. The model answers in Markdown; without this, bubbles show the
  literal asterisks. Lists and newlines pass through (whitespace-pre-wrap).
*/
const TOKEN = /(\*\*.+?\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;

function renderInline(text: string) {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="font-mono text-[12px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export default function AgentMessage({ message }: { message: Msg }) {
  const isUser = message.role === 'user';

  // Extract visible text. Skip tool_result blocks (internal) entirely.
  let text = '';
  if (typeof message.content === 'string') {
    text = message.content;
  } else {
    const blocks = message.content;
    const hasToolResult = blocks.some((b) => b.type === 'tool_result');
    if (hasToolResult) return null; // hide tool_result user turns
    text = blocks
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('\n');
    if (!text) {
      const toolUses = blocks.filter((b) => b.type === 'tool_use');
      if (toolUses.length === 0) return null;
    }
  }

  if (!text) return null;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] border border-line rounded-xl p-2.5 font-sans text-[13px] whitespace-pre-wrap break-words ${
          isUser ? 'bg-orange text-ink shadow-brut-sm' : 'bg-surface text-bone shadow-brut-sm'
        }`}
      >
        {renderInline(text)}
      </div>
    </div>
  );
}
