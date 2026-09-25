'use client';

import { useState } from 'react';
import { ArrowUpRight, Loader2, Check, AlertCircle, HelpCircle } from 'lucide-react';
import { useWalletStore } from '@/store/useWalletStore';
import { useAgentStore } from '@/store/useAgentStore';
import { lnAddressToInvoice } from '@/lib/wallet/lightning';
import { classifyPaymentInput, decodeInvoice } from '@/lib/wallet/invoice';

export default function SendCard() {
  const { adapter } = useWalletStore();
  const queueQuestion = useAgentStore((s) => s.queueQuestion);

  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [memo, setMemo] = useState('');
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!adapter) return null;

  const reset = () => {
    setRecipient('');
    setAmount('');
    setMemo('');
    setError(null);
    setDone(false);
  };

  /*
    Name what was pasted instead of making the user work it out. Community
    feedback on the build-in-public thread put it exactly right: "if the
    clipboard is bolt11, LNURL, or onchain, name it and continue — that extra
    hop is usually a second product."
  */
  const classified = classifyPaymentInput(recipient);
  const isBolt11 = classified.kind === 'bolt11';
  const isLnAddress = classified.kind === 'lightning-address';

  /*
    Security audit F-07: a pasted invoice used to be paid without ever being
    decoded or displayed, so the user could not see what they were spending.
    Decode on input and show it.
  */
  let decoded: ReturnType<typeof decodeInvoice> | null = null;
  let decodeError: string | null = null;
  if (isBolt11) {
    try {
      decoded = decodeInvoice(recipient);
    } catch {
      decodeError = 'This does not decode as a valid Lightning invoice.';
    }
  }

  const send = async () => {
    setError(null);
    const target = recipient.trim();
    if (!target) {
      setError('Enter a Lightning address or BOLT11 invoice');
      return;
    }
    setPaying(true);
    try {
      let bolt11 = target;
      let expectedSats: number;

      if (isLnAddress) {
        const sats = Number(amount);
        if (!Number.isFinite(sats) || sats <= 0) {
          throw new Error('Enter an amount in sats');
        }
        bolt11 = await lnAddressToInvoice(target, sats, memo.trim() || undefined);
        expectedSats = sats;
      } else if (isBolt11) {
        // Pay exactly what was decoded and shown on screen — nothing else.
        const d = decodeInvoice(target);
        expectedSats = d.hasAmount ? d.sats : Number(amount);
        if (!Number.isFinite(expectedSats) || expectedSats <= 0) {
          throw new Error('This invoice has no amount — enter one in sats');
        }
      } else if (classified.kind === 'onchain') {
        throw new Error('That is an on-chain address. zappr sends over Lightning only.');
      } else if (classified.kind === 'lnurl') {
        throw new Error('LNURL is not supported yet — paste a Lightning address or invoice.');
      } else {
        throw new Error('Recipient must be a Lightning address or BOLT11 invoice');
      }

      await adapter.payInvoice(bolt11, expectedSats);
      setDone(true);
      setTimeout(() => {
        reset();
        setOpen(false);
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setPaying(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="brut-btn-ghost w-full flex items-center justify-center gap-2 text-xs"
      >
        <ArrowUpRight className="w-3.5 h-3.5" /> Send sats
      </button>
    );
  }

  const showAmount = !isBolt11 || (decoded !== null && !decoded.hasAmount);

  return (
    <div className="brut-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-bone/60">
          <ArrowUpRight className="w-3.5 h-3.5 text-orange" /> Send
        </div>
        <button
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="font-mono text-[10px] text-bone/50 hover:text-orange transition"
        >
          close
        </button>
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-bone/50 block mb-1">
          To
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="user@domain.com or lnbc1..."
          className="brut-input text-xs"
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {recipient.trim() && (
        <div className="font-mono text-[10px] text-bone/60 flex items-center gap-1.5">
          <HelpCircle className="w-3 h-3 text-orange shrink-0" />
          <span>Detected: {classified.label}</span>
        </div>
      )}

      {decodeError && (
        <div className="font-mono text-[10px] text-orange flex items-center gap-1.5">
          <AlertCircle className="w-3 h-3 shrink-0" /> {decodeError}
        </div>
      )}

      {/* What this invoice actually costs — shown before anything is spent. */}
      {decoded && (
        <div className="brut p-3 space-y-1 bg-bone/5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-bone/50">
            This invoice
          </div>
          <div className="font-mono text-lg font-bold text-bone">
            {decoded.hasAmount ? `${decoded.sats.toLocaleString()} sats` : 'No amount set'}
          </div>
          {decoded.description && (
            <div className="font-mono text-[10px] text-bone/60">{decoded.description}</div>
          )}
          {decoded.isExpired && (
            <div className="font-mono text-[10px] text-orange">Expired — ask for a new one.</div>
          )}
        </div>
      )}

      {showAmount && (
        <>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-bone/50 block mb-1">
              Amount (sats)
            </label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
              className="brut-input text-sm"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-bone/50 block mb-1">
              Memo (optional)
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="thanks!"
              className="brut-input text-sm"
              maxLength={120}
            />
          </div>
        </>
      )}

      {error && (
        <div className="font-mono text-[10px] text-orange flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </div>
      )}

      <button
        onClick={send}
        disabled={paying || done}
        className="brut-btn w-full flex items-center justify-center gap-2 text-xs"
      >
        {paying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : done ? <Check className="w-3.5 h-3.5" /> : null}
        {done ? 'Sent' : paying ? 'Sending…' : 'Send'}
      </button>

      <button
        onClick={() =>
          queueQuestion(
            "In one short sentence, explain what a Lightning address is to a complete beginner — like email but for sats. Then in another sentence, what a BOLT11 invoice is. Plain language, no jargon."
          )
        }
        className="w-full flex items-center justify-center gap-1.5 font-mono text-[10px] text-bone/50 hover:text-orange transition"
      >
        <HelpCircle className="w-3 h-3" />
        Lightning address vs BOLT11?
      </button>
    </div>
  );
}
