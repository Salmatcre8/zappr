/*
  Client-side tool executor — port of web src/lib/agent/clientExecutor.ts.
  When Claude asks to check balance / send / zap / post, the tool runs HERE,
  against the on-device wallet + Nostr layers. Keys never leave the device;
  the server only proxies Claude.
*/
import { useNostrStore } from '@/store/useNostrStore';
import { useWalletStore } from '@/store/useWalletStore';
import { lnAddressToInvoice } from '@/lib/wallet/lightning';
import { publishNote, fetchProfile } from '@/lib/nostr/events';
import { npubToHex } from '@/lib/nostr/keys';
import { API_BASE } from './api';

export async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  const nostr = useNostrStore.getState();
  const wallet = useWalletStore.getState();

  switch (name) {
    case 'get_wallet_balance': {
      if (!wallet.adapter) return { error: 'Wallet not connected' };
      const sats = await wallet.adapter.getBalance();
      wallet.setBalance(sats);
      return { balance_sats: sats };
    }
    case 'get_transaction_history': {
      if (!wallet.adapter) return { error: 'Wallet not connected' };
      const limit = (input.limit as number) || 10;
      const txs = await wallet.adapter.listTransactions(limit);
      return { transactions: txs };
    }
    case 'get_feed_summary': {
      const limit = (input.limit as number) || 10;
      const notes = nostr.feed.slice(0, limit).map((n) => {
        const p = nostr.profiles[n.pubkey];
        return {
          author: p?.displayName || p?.name || n.pubkey.slice(0, 8),
          npub: p?.npub,
          content: n.content,
          created_at: n.createdAt,
        };
      });
      return { count: notes.length, notes };
    }
    case 'send_payment': {
      if (!wallet.adapter) return { error: 'Wallet not connected' };
      const recipient = String(input.recipient || '');
      const amount = Number(input.amount_sats || 0);
      if (!recipient || amount <= 0) return { error: 'Invalid recipient or amount' };
      let bolt11 = recipient;
      if (recipient.includes('@')) {
        bolt11 = await lnAddressToInvoice(recipient, amount, String(input.memo || ''));
      }
      const res = await wallet.adapter.payInvoice(bolt11);
      return { success: true, preimage: res.preimage };
    }
    case 'zap_note': {
      if (!wallet.adapter) return { error: 'Wallet not connected' };
      if (!nostr.ndk) return { error: 'Nostr not connected' };
      const npub = String(input.target_npub || '');
      const amount = Number(input.amount_sats || 0);
      if (!npub || amount <= 0) return { error: 'Invalid target or amount' };
      const hex = npubToHex(npub);
      const profile = await fetchProfile(nostr.ndk, hex);
      if (!profile?.lud16) return { error: 'Target has no Lightning address' };
      const bolt11 = await lnAddressToInvoice(profile.lud16, amount, 'zap via zappr');
      const res = await wallet.adapter.payInvoice(bolt11);
      return { success: true, preimage: res.preimage };
    }
    case 'post_note': {
      if (!nostr.ndk) return { error: 'Nostr not connected' };
      if (!nostr.pubkey) return { error: 'Log in with your nsec to post' };
      const content = String(input.content || '');
      if (!content) return { error: 'Empty content' };
      const id = await publishNote(nostr.ndk, content);
      return { success: true, event_id: id };
    }
    case 'quote_offramp_ngn': {
      const res = await fetch(`${API_BASE}/api/offramp/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_ngn: Number(input.amount_ngn || 0),
          account_number: String(input.account_number || ''),
          bank: String(input.bank || ''),
          account_name: input.account_name ? String(input.account_name) : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) return { error: (body as { error?: string })?.error || 'Quote failed' };
      return body;
    }
    case 'execute_offramp_ngn': {
      if (!wallet.adapter) return { error: 'Wallet not connected' };
      const invoice = String(input.invoice || '');
      const orderId = String(input.order_id || '');
      if (!invoice) return { error: 'Missing invoice' };

      // Pay the Lightning invoice from the user's wallet — this is what
      // triggers MavaPay to release the NGN payout.
      const payRes = await wallet.adapter.payInvoice(invoice);

      // Poll status for ~30s. Real settlement may take longer; we surface
      // whatever state MavaPay reports so the agent can speak to the user.
      let finalStatus: unknown = null;
      if (orderId) {
        const deadline = Date.now() + 30_000;
        while (Date.now() < deadline) {
          try {
            const sres = await fetch(
              `${API_BASE}/api/offramp/status?order_id=${encodeURIComponent(orderId)}`
            );
            if (sres.ok) {
              const sbody = (await sres.json()) as { status?: string };
              finalStatus = sbody;
              if (sbody?.status === 'sent' || sbody?.status === 'paid') break;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 3_000));
        }
      }
      return {
        success: true,
        preimage: payRes.preimage,
        order_id: orderId,
        status: finalStatus,
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
