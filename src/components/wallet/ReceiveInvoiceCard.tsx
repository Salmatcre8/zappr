'use client';

import { useState } from 'react';
import { ArrowDownLeft, Loader2, Copy, Check, HelpCircle, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useWalletStore } from '@/store/useWalletStore';
import { useAgentStore } from '@/store/useAgentStore';

export default function ReceiveInvoiceCard() {
  const { adapter } = useWalletStore();
  const queueQuestion = useAgentStore((s) => s.queueQuestion);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>('');
  const [memo, setMemo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!adapter) return null;

  const reset = () => {
    setInvoice(null);
    setAmount('');
    setMemo('');
    setError(null);
    setCopied(false);
  };

  const generate = async () => {
    setError(null);
    const sats = Number(amount);
    if (!Number.isFinite(sats) || sats <= 0) {
      setError('Enter an amount in sats');
      return;
    }
    setGenerating(true);
    try {
      const bolt11 = await adapter.makeInvoice(sats, memo.trim() || undefined);
      setInvoice(bolt11);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create invoice');
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    if (!invoice) return;
    try {
      await navigator.clipboard.writeText(invoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const askAgent = () => {
    queueQuestion(
      "In one or two short sentences, explain what a BOLT11 invoice is to a complete beginner — like I've never used Bitcoin before. Use plain language, no jargon."
    );
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="brut-btn w-full flex items-center justify-center gap-2 text-xs"
      >
        <ArrowDownLeft className="w-3.5 h-3.5" /> Receive sats
      </button>
    );
  }

  return (
    <div className="brut-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-bone/60">
          <ArrowDownLeft className="w-3.5 h-3.5 text-volt" /> Receive
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

      {!invoice ? (
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
              autoFocus
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
              placeholder="coffee with friend"
              className="brut-input text-sm"
              maxLength={120}
            />
          </div>

          {error && <div className="font-mono text-[10px] text-orange">{error}</div>}

          <button
            onClick={generate}
            disabled={generating}
            className="brut-btn w-full flex items-center justify-center gap-2 text-xs"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {generating ? 'Generating…' : 'Generate invoice'}
          </button>

          <button
            onClick={askAgent}
            className="w-full flex items-center justify-center gap-1.5 font-mono text-[10px] text-bone/50 hover:text-volt transition"
          >
            <HelpCircle className="w-3 h-3" />
            What&apos;s a BOLT11 invoice?
          </button>
        </>
      ) : (
        <>
          <div className="bg-white border-2 border-black p-3 flex items-center justify-center">
            <QRCodeSVG
              value={invoice}
              size={180}
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="M"
              marginSize={2}
            />
          </div>

          <div className="bg-ink text-volt border-2 border-black p-2 font-mono text-[9px] leading-relaxed break-all max-h-20 overflow-y-auto">
            {invoice}
          </div>

          <div className="font-mono text-[10px] text-bone/60">
            <span className="text-orange">{Number(amount).toLocaleString()}</span> sats
            {memo && <> · {memo}</>}
          </div>

          <div className="flex gap-2">
            <button
              onClick={copy}
              className="brut-btn flex-1 flex items-center justify-center gap-1.5 text-xs"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={reset}
              className="brut-btn-ghost flex items-center justify-center gap-1.5 text-xs px-3"
              aria-label="New invoice"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          <p className="font-mono text-[10px] text-bone/40 leading-relaxed">
            Share the QR or string. Invoice expires after a few minutes.
          </p>
        </>
      )}
    </div>
  );
}
