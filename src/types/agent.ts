export type AgentContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

export type AgentMessage = {
  role: 'user' | 'assistant';
  content: string | AgentContentBlock[];
};

export type PendingConfirmation = {
  id: string;
  tool: 'send_payment' | 'zap_note' | 'post_note';
  input: Record<string, unknown>;
  toolUseId: string;
};
