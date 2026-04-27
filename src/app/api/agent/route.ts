import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { AGENT_TOOLS } from '@/lib/agent/tools';
import { SYSTEM_PROMPT } from '@/lib/agent/systemPrompt';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: { messages: Anthropic.MessageParam[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
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
