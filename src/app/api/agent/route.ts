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

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
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
    const message = err instanceof Error ? err.message : 'Agent error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
