/*
  The AI runs server-side (issue #9): the deployed web app's /api/agent route
  holds the Anthropic key and the rate limiter. The mobile app just POSTs the
  conversation over HTTPS — no API key ever ships on-device.
*/
import type { AgentContentBlock, AgentMessage } from '@/types/agent';

export const API_BASE =
  process.env.EXPO_PUBLIC_ZAPPR_API_BASE ?? 'https://www.usezappr.xyz';

export type AgentResponse = { content: AgentContentBlock[]; stop_reason: string };

export async function callAgent(messages: AgentMessage[]): Promise<AgentResponse> {
  const res = await fetch(`${API_BASE}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (res.status === 429) {
    throw new Error('Slow down a moment — too many requests. Try again shortly.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Agent error' }));
    throw new Error((err as { error?: string }).error || 'Agent error');
  }
  return (await res.json()) as AgentResponse;
}
