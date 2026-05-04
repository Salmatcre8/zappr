'use client';

import { useEffect, useRef } from 'react';
import { Bot } from 'lucide-react';
import { useAgentStore } from '@/store/useAgentStore';
import AgentInput from './AgentInput';
import AgentMessage from './AgentMessage';
import { executeTool } from '@/lib/agent/clientExecutor';
import { CONFIRM_TOOLS } from '@/lib/agent/tools';
import type { AgentMessage as Msg } from '@/types/agent';

type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
type TextBlock = { type: 'text'; text: string };
type ContentBlock = ToolUseBlock | TextBlock;

async function callAgent(messages: Msg[]) {
  const res = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Agent error' }));
    throw new Error(err.error || 'Agent error');
  }
  return res.json() as Promise<{ content: ContentBlock[]; stop_reason: string }>;
}

export default function AgentChat() {
  const {
    messages, addMessage, setMessages, busy, setBusy, status, setStatus,
    pending, setPending, queuedQuestion, clearQueuedQuestion,
  } = useAgentStore();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, status, pending]);

  // Pick up questions queued from elsewhere in the app (e.g. the
  // "What's a BOLT11 invoice?" link on the receive card).
  useEffect(() => {
    if (queuedQuestion && !busy) {
      handleSend(queuedQuestion);
      clearQueuedQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedQuestion, busy]);

  const runLoop = async (initial: Msg[]) => {
    setBusy(true);
    setStatus('Thinking…');
    let convo: Msg[] = initial;
    try {
      // Loop until stop_reason !== 'tool_use'
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const resp = await callAgent(convo);
        const assistantMsg: Msg = { role: 'assistant', content: resp.content as Msg['content'] };
        convo = [...convo, assistantMsg];
        setMessages(convo);

        if (resp.stop_reason !== 'tool_use') break;

        const toolUses = (resp.content || []).filter((b): b is ToolUseBlock => b.type === 'tool_use');

        // Check for confirmation-required tools first
        const needsConfirm = toolUses.find((t) => CONFIRM_TOOLS.has(t.name));
        if (needsConfirm) {
          setPending({
            id: crypto.randomUUID(),
            tool: needsConfirm.name as 'send_payment' | 'zap_note' | 'post_note',
            input: needsConfirm.input,
            toolUseId: needsConfirm.id,
          });
          setStatus(null);
          setBusy(false);
          return; // Pause loop — confirmation UI will resume
        }

        // Execute non-confirm tools
        const results = [];
        for (const tu of toolUses) {
          setStatus(`⚡ ${tu.name.replace(/_/g, ' ')}…`);
          try {
            const out = await executeTool(tu.name, tu.input);
            results.push({ type: 'tool_result' as const, tool_use_id: tu.id, content: JSON.stringify(out) });
          } catch (e) {
            results.push({
              type: 'tool_result' as const,
              tool_use_id: tu.id,
              content: JSON.stringify({ error: e instanceof Error ? e.message : 'Tool failed' }),
            });
          }
        }
        convo = [...convo, { role: 'user', content: results as Msg['content'] }];
        setMessages(convo);
      }
    } catch (e) {
      addMessage({
        role: 'assistant',
        content: [{ type: 'text', text: `⚠ ${e instanceof Error ? e.message : 'Agent error'}` }],
      });
    } finally {
      setStatus(null);
      setBusy(false);
    }
  };

  const handleSend = (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: Msg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    runLoop(next);
  };

  const handleConfirm = async (approve: boolean) => {
    if (!pending) return;
    const toolUseId = pending.toolUseId;
    const convo = [...messages];
    setPending(null);

    let resultContent: string;
    if (approve) {
      setBusy(true);
      setStatus(`⚡ Executing ${pending.tool.replace('_', ' ')}…`);
      try {
        const out = await executeTool(pending.tool, pending.input);
        resultContent = JSON.stringify(out);
      } catch (e) {
        resultContent = JSON.stringify({ error: e instanceof Error ? e.message : 'Tool failed' });
      }
    } else {
      resultContent = JSON.stringify({ error: 'User cancelled' });
    }

    const next: Msg[] = [
      ...convo,
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUseId, content: resultContent }] as Msg['content'],
      },
    ];
    setMessages(next);
    runLoop(next);
  };

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-black">
        <div className="w-7 h-7 bg-orange flex items-center justify-center border-2 border-black">
          <Bot className="w-4 h-4 text-ink" strokeWidth={2.5} />
        </div>
        <div className="font-mono text-xs uppercase tracking-widest text-bone/70">zappr Agent</div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="font-mono text-xs text-bone/50 mb-3">Ask me anything</div>
            <div className="flex flex-col gap-1.5">
              {[
                "What's happening in my feed?",
                'Check my balance',
                'Show my recent transactions',
                'Summarize the top posts',
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="border-2 border-black bg-surface px-2 py-1.5 font-mono text-[11px] hover:bg-volt hover:text-ink transition text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <AgentMessage key={i} message={m} />
        ))}

        {pending && (
          <div className="bg-surface border-2 border-orange p-3 shadow-brut-orange">
            <div className="font-mono text-[10px] uppercase tracking-widest text-orange mb-2">
              Confirm {pending.tool.replace('_', ' ')}
            </div>
            <pre className="font-mono text-[11px] text-bone/80 whitespace-pre-wrap break-all mb-3">
              {JSON.stringify(pending.input, null, 2)}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={() => handleConfirm(true)}
                className="flex-1 border-2 border-black bg-orange text-ink font-mono text-xs py-1.5 font-bold hover:-translate-x-[1px] hover:-translate-y-[1px] transition"
              >
                APPROVE
              </button>
              <button
                onClick={() => handleConfirm(false)}
                className="flex-1 border-2 border-black bg-panel font-mono text-xs py-1.5 font-bold hover:bg-volt hover:text-ink transition"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {status && (
          <div className="font-mono text-[11px] text-volt border-2 border-black bg-surface px-3 py-1.5 inline-block">
            {status}
          </div>
        )}
      </div>

      <AgentInput onSend={handleSend} />
    </>
  );
}
