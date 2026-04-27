import type Anthropic from '@anthropic-ai/sdk';

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_wallet_balance',
    description: "Get the user's current Lightning wallet balance in sats.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'send_payment',
    description:
      'Send a Lightning payment to a Lightning address (user@domain.com) or BOLT11 invoice. Requires user confirmation before executing.',
    input_schema: {
      type: 'object',
      properties: {
        recipient: { type: 'string', description: 'Lightning address or BOLT11 invoice' },
        amount_sats: { type: 'number', description: 'Amount in satoshis' },
        memo: { type: 'string', description: 'Optional memo' },
      },
      required: ['recipient', 'amount_sats'],
    },
  },
  {
    name: 'zap_note',
    description: 'Zap (tip) a Nostr user with sats. Requires user confirmation before executing.',
    input_schema: {
      type: 'object',
      properties: {
        target_npub: { type: 'string', description: 'npub of the user to zap' },
        event_id: { type: 'string', description: 'Optional event id being zapped' },
        amount_sats: { type: 'number', description: 'Amount in satoshis' },
      },
      required: ['target_npub', 'amount_sats'],
    },
  },
  {
    name: 'get_feed_summary',
    description: "Read the user's current Nostr feed and return recent notes.",
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'How many notes to include (default 10)' },
      },
    },
  },
  {
    name: 'get_transaction_history',
    description: "Get the user's recent Lightning transactions.",
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
  },
  {
    name: 'post_note',
    description: 'Post a new note to Nostr on behalf of the user. Requires user confirmation before executing.',
    input_schema: {
      type: 'object',
      properties: { content: { type: 'string' } },
      required: ['content'],
    },
  },
];

export const CONFIRM_TOOLS = new Set(['send_payment', 'zap_note', 'post_note']);
