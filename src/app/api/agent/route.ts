import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { AGENT_TOOLS } from '@/lib/agent/tools';
import { SYSTEM_PROMPT } from '@/lib/agent/systemPrompt';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';

// Guardrails against runaway Claude token spend. Tunable via env without a deploy.
const RATE_LIMIT = Number(process.env.AGENT_RATE_LIMIT ?? 20); // requests...
const RATE_WINDOW_MS = Number(process.env.AGENT_RATE_WINDOW_MS ?? 60_000); // ...per minute, per IP
const MAX_MESSAGES = Number(process.env.AGENT_MAX_MESSAGES ?? 100); // conversation length cap
const MAX_BODY_BYTES = Number(process.env.AGENT_MAX_BODY_BYTES ?? 256 * 1024); // 256KB payload cap

/*
  Fallback provider: when the Claude call fails (rate limit, overload,
  exhausted credits), the same conversation is re-run on OpenAI and the
  response is translated back into the Anthropic wire shape the web and
  mobile clients already parse — no client changes on either app.
*/
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

export async function POST(req: NextRequest) {
  const haveAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const haveOpenAI = !!process.env.OPENAI_API_KEY;
  if (!haveAnthropic && !haveOpenAI) {
    return NextResponse.json({ error: 'No AI provider configured' }, { status: 500 });
  }

  // 1. Per-IP rate limit — first line of defense against a single abuser.
  const ip = getClientIp(req);
  const limit = rateLimit(`agent:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Slow down a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  // 2. Reject oversized payloads early (cheap input-token-balloon guard).
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  let body: { messages: Anthropic.MessageParam[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 3. Validate shape + cap conversation length.
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: 'messages must be a non-empty array' }, { status: 400 });
  }
  if (body.messages.length > MAX_MESSAGES) {
    return NextResponse.json(
      { error: 'Conversation too long. Start a new chat.' },
      { status: 400 },
    );
  }

  // 4. Claude first; OpenAI as the fallback lane.
  let claudeError: unknown = null;
  if (haveAnthropic) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: AGENT_TOOLS,
        messages: body.messages,
      });
      return NextResponse.json({
        id: response.id,
        content: response.content,
        stop_reason: response.stop_reason,
      });
    } catch (err: unknown) {
      claudeError = err;
    }
  }

  if (haveOpenAI) {
    try {
      const fallback = await openAIFallback(body.messages);
      return NextResponse.json(fallback);
    } catch {
      // fall through to the original Claude error below
    }
  }

  const message = claudeError instanceof Error ? claudeError.message : 'Agent error';
  return NextResponse.json({ error: message }, { status: 500 });
}

/* ── OpenAI fallback lane ─────────────────────────────────────────────
   Plain fetch to Chat Completions (no SDK dependency). Translates the
   Anthropic-shaped conversation → OpenAI format, and the OpenAI response
   → Anthropic-shaped {content, stop_reason} so clients stay unchanged. */

type OpenAIToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type OpenAIMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenAIToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

function blockText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === 'string' ? c : c?.type === 'text' ? c.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  return JSON.stringify(content ?? '');
}

function toOpenAIMessages(messages: Anthropic.MessageParam[]): OpenAIMessage[] {
  const out: OpenAIMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];

  for (const m of messages) {
    if (typeof m.content === 'string') {
      if (m.role === 'assistant') out.push({ role: 'assistant', content: m.content });
      else out.push({ role: 'user', content: m.content });
      continue;
    }

    if (m.role === 'assistant') {
      const text = m.content
        .filter((b): b is Anthropic.TextBlockParam => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      const toolCalls: OpenAIToolCall[] = m.content
        .filter((b): b is Anthropic.ToolUseBlockParam => b.type === 'tool_use')
        .map((b) => ({
          id: b.id,
          type: 'function' as const,
          function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
        }));
      out.push({
        role: 'assistant',
        content: text || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
      continue;
    }

    // role: user — may carry tool_result blocks (OpenAI wants role:"tool") + text
    const toolResults = m.content.filter(
      (b): b is Anthropic.ToolResultBlockParam => b.type === 'tool_result',
    );
    for (const tr of toolResults) {
      out.push({
        role: 'tool',
        tool_call_id: tr.tool_use_id,
        content: blockText(tr.content),
      });
    }
    const text = m.content
      .filter((b): b is Anthropic.TextBlockParam => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    if (text) out.push({ role: 'user', content: text });
  }

  return out;
}

async function openAIFallback(messages: Anthropic.MessageParam[]): Promise<{
  id: string;
  content: unknown[];
  stop_reason: string;
}> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 1024,
      messages: toOpenAIMessages(messages),
      tools: AGENT_TOOLS.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`OpenAI fallback failed (${res.status}): ${errBody.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    id: string;
    choices: {
      finish_reason: string;
      message: { content: string | null; tool_calls?: OpenAIToolCall[] };
    }[];
  };
  const choice = data.choices?.[0];
  if (!choice) throw new Error('OpenAI fallback returned no choices');

  // Translate back to the Anthropic content-block shape the clients parse.
  const content: unknown[] = [];
  if (choice.message.content) {
    content.push({ type: 'text', text: choice.message.content });
  }
  for (const tc of choice.message.tool_calls ?? []) {
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(tc.function.arguments || '{}');
    } catch {}
    content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
  }

  return {
    id: data.id,
    content,
    stop_reason: choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
  };
}
