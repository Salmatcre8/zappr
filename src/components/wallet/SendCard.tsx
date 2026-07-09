'use client';

import { useState } from 'react';
import { ArrowUpRight, Loader2, Check, AlertCircle, HelpCircle } from 'lucide-react';
import { useWalletStore } from '@/store/useWalletStore';
import { useAgentStore } from '@/store/useAgentStore';
import { lnAddressToInvoice } from '@/lib/wallet/lightning';

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

  const isBolt11 = (s: string) => /^lnbc/i.test(s.trim());
  const isLnAddress = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

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
      if (isLnAddress(target)) {
        const sats = Number(amount);
        if (!Number.isFinite(sats) || sats <= 0) {
          throw new Error('Enter an amount in sats');
        }
        bolt11 = await lnAddressToInvoice(target, sats, memo.trim() || undefined);
      } else if (!isBolt11(target)) {
        throw new Error('Recipient must be a Lightning address or BOLT11 invoice');
      }
      await adapter.payInvoice(bolt11);
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

  const showAmount = !isBolt11(recipient);

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
