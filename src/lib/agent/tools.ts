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
  {
    name: 'quote_offramp_ngn',
    description:
      "Get a quote for converting Lightning sats to Nigerian naira (NGN), paid into a bank account via MavaPay. Use this whenever the user wants to cash out, withdraw to bank, or 'send sats and receive naira'. This is read-only — it just creates a quote. No payment happens until the user approves execute_offramp_ngn.",
    input_schema: {
      type: 'object',
      properties: {
        amount_ngn: {
          type: 'number',
          description: 'Amount of Nigerian naira (NGN) to receive in the bank. Minimum 2000 NGN.',
        },
        account_number: {
          type: 'string',
          description: '10-digit Nigerian bank account number',
        },
        bank: {
          type: 'string',
          description: 'Bank name (e.g. "GTBank", "OPAY", "Access Bank", "Kuda Bank"). Will be matched against MavaPay\'s NIP bank list.',
        },
        account_name: {
          type: 'string',
          description: 'Optional account holder name. If omitted, MavaPay name-enquiry is attempted.',
        },
      },
      required: ['amount_ngn', 'account_number', 'bank'],
    },
  },
  {
    name: 'execute_offramp_ngn',
    description:
      'Execute a previously-created NGN offramp quote: pay the Lightning invoice from the user wallet, which triggers MavaPay to send NGN to the bank. Requires user confirmation before running. Use the values returned by quote_offramp_ngn.',
    input_schema: {
      type: 'object',
      properties: {
        quote_id: { type: 'string', description: 'id from quote_offramp_ngn' },
        order_id: { type: 'string', description: 'order_id from quote_offramp_ngn' },
        invoice: { type: 'string', description: 'Lightning BOLT11 invoice to pay' },
        sats_to_send: { type: 'number', description: 'Total sats that will leave the wallet (incl. fee)' },
        ngn_to_receive: { type: 'number', description: 'NGN that will land in the bank' },
        bank_name: { type: 'string', description: 'Resolved bank name' },
        account_number: { type: 'string', description: 'Account number' },
        account_name: { type: 'string', description: 'Account holder name' },
      },
      required: ['quote_id', 'order_id', 'invoice', 'sats_to_send'],
    },
  },
];

export const CONFIRM_TOOLS = new Set([
  'send_payment',
  'zap_note',
  'post_note',
  'execute_offramp_ngn',
]);
