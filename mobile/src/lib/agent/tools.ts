/*
  Tool definitions live server-side (web src/lib/agent/tools.ts feeds /api/agent).
  The client only needs to know which tools move money or post publicly —
  those ALWAYS pause for explicit user confirmation before executing.
  This is a core trust guarantee; do not add a bypass.
*/
export const CONFIRM_TOOLS = new Set([
  'send_payment',
  'zap_note',
  'post_note',
  'execute_offramp_ngn',
]);
