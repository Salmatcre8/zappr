'use client';

import type { AgentMessage as Msg } from '@/types/agent';

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
        className={`max-w-[85%] border-2 border-black p-2.5 font-sans text-[13px] whitespace-pre-wrap break-words ${
          isUser ? 'bg-volt text-ink shadow-brut-sm' : 'bg-surface text-bone shadow-brut-sm'
        }`}
      >
        {text}
      </div>
    </div>
  );
}
