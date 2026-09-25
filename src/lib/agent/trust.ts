/*
  The trust boundary between untrusted content and spending power.

  Security audit F-02 (Critical): get_feed_summary copies note text written by
  any stranger on a public relay into the same model context that holds
  send_payment, zap_note and execute_offramp_ngn. Reaching a victim's feed costs
  nothing and needs no follow — a note carrying a hashtag they read is enough.

  The approval card is not a sufficient defence on its own, because the card is
  written by the same influenced turn. F-01 closed half of that by binding the
  card's figure to the invoice actually paid; this closes the other half by
  making sure the turn that read the stranger's text has no spending tools to
  reach for in the first place.

  Enforced on the SERVER, where the model has no say: the tool list is chosen
  before the request is made. Prompt wording is a hint; removing the tool is a
  fact.
*/

/** Tools whose results carry text authored by third parties. */
export const UNTRUSTED_READ_TOOLS = new Set(['get_feed_summary']);

/** Tools that move money. */
export const SPEND_TOOLS = new Set(['send_payment', 'zap_note', 'execute_offramp_ngn']);

type ContentBlock = { type: string; name?: string };
export type AgentMessage = { role: 'user' | 'assistant'; content: string | ContentBlock[] };

/*
  A turn starts at the user's own typed message and runs through the tool
  round-trips that follow it. Tool results come back as user messages whose
  content is an array, so a genuine user message is the one carrying a string.
*/
function turnStartIndex(messages: AgentMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'user' && typeof m.content === 'string') return i;
  }
  return 0;
}

/** Has this turn already pulled in text written by someone else? */
export function turnHasUntrustedContent(messages: AgentMessage[]): boolean {
  for (let i = turnStartIndex(messages); i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== 'assistant' || typeof m.content === 'string') continue;
    for (const block of m.content) {
      if (block.type === 'tool_use' && block.name && UNTRUSTED_READ_TOOLS.has(block.name)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * The tools this request is allowed to offer. Once a turn has read third-party
 * text, it finishes that turn without any way to spend; the user's next typed
 * message starts a clean turn and gets them back.
 */
export function selectTools<T extends { name: string }>(
  all: readonly T[],
  messages: AgentMessage[]
): T[] {
  if (!turnHasUntrustedContent(messages)) return [...all];
  return all.filter((t) => !SPEND_TOOLS.has(t.name));
}

/*
  Hard limits the model cannot argue with. These are not prompt guidance — they
  are checked in the executor immediately before the wallet is asked to pay, so
  no amount of influence over the conversation can raise them.
*/
export const MAX_SATS_PER_PAYMENT = Number(
  process.env.NEXT_PUBLIC_MAX_SATS_PER_PAYMENT ?? 100_000
);
export const MAX_SATS_PER_DAY = Number(process.env.NEXT_PUBLIC_MAX_SATS_PER_DAY ?? 500_000);

const SPEND_LOG_KEY = 'zappr:agent-spend';

type SpendLog = { day: string; total: number };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readLog(): SpendLog {
  if (typeof localStorage === 'undefined') return { day: todayKey(), total: 0 };
  try {
    const raw = localStorage.getItem(SPEND_LOG_KEY);
    if (!raw) return { day: todayKey(), total: 0 };
    const parsed = JSON.parse(raw) as SpendLog;
    return parsed.day === todayKey() ? parsed : { day: todayKey(), total: 0 };
  } catch {
    return { day: todayKey(), total: 0 };
  }
}

/**
 * Check an agent-initiated payment against the caps. Returns an error string to
 * surface to the user, or null when the payment is allowed.
 */
export function checkSpendCaps(sats: number): string | null {
  if (!Number.isFinite(sats) || sats <= 0) return 'Invalid amount';
  if (sats > MAX_SATS_PER_PAYMENT) {
    return `That is ${sats.toLocaleString()} sats — above the ${MAX_SATS_PER_PAYMENT.toLocaleString()} per-payment limit for agent payments. Send it from the wallet screen instead.`;
  }
  const log = readLog();
  if (log.total + sats > MAX_SATS_PER_DAY) {
    const left = Math.max(0, MAX_SATS_PER_DAY - log.total);
    return `That would take today's agent spending past the ${MAX_SATS_PER_DAY.toLocaleString()} sat daily limit (${left.toLocaleString()} left). Send it from the wallet screen instead.`;
  }
  return null;
}

/** Record a completed agent payment against today's total. */
export function recordSpend(sats: number): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const log = readLog();
    localStorage.setItem(
      SPEND_LOG_KEY,
      JSON.stringify({ day: todayKey(), total: log.total + sats })
    );
  } catch {
    // A full or blocked localStorage must not break a payment that succeeded.
  }
}
