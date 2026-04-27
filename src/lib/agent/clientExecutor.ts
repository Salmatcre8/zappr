import { useNostrStore } from '@/store/useNostrStore';
import { useWalletStore } from '@/store/useWalletStore';
import { getBalanceSats, listTransactions, payInvoice, lnAddressToInvoice } from '@/lib/wallet/lightning';
import { publishNote, fetchProfile } from '@/lib/nostr/events';
import { npubToHex } from '@/lib/nostr/keys';

export async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  const nostr = useNostrStore.getState();
  const wallet = useWalletStore.getState();

  switch (name) {
    case 'get_wallet_balance': {
      if (!wallet.provider) return { error: 'Wallet not connected' };
      const sats = await getBalanceSats(wallet.provider);
      wallet.setBalance(sats);
      return { balance_sats: sats };
    }
    case 'get_transaction_history': {
      if (!wallet.provider) return { error: 'Wallet not connected' };
      const limit = (input.limit as number) || 10;
      const txs = await listTransactions(wallet.provider, limit);
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
      if (!wallet.provider) return { error: 'Wallet not connected' };
      const recipient = String(input.recipient || '');
      const amount = Number(input.amount_sats || 0);
      if (!recipient || amount <= 0) return { error: 'Invalid recipient or amount' };
      let bolt11 = recipient;
      if (recipient.includes('@')) {
        bolt11 = await lnAddressToInvoice(recipient, amount, String(input.memo || ''));
      }
      const res = await payInvoice(wallet.provider, bolt11);
      return { success: true, preimage: (res as { preimage?: string }).preimage };
    }
    case 'zap_note': {
      if (!wallet.provider) return { error: 'Wallet not connected' };
      if (!nostr.ndk) return { error: 'Nostr not connected' };
      const npub = String(input.target_npub || '');
      const amount = Number(input.amount_sats || 0);
      if (!npub || amount <= 0) return { error: 'Invalid target or amount' };
      const hex = npubToHex(npub);
      const profile = await fetchProfile(nostr.ndk, hex);
      if (!profile?.lud16) return { error: 'Target has no Lightning address' };
      const bolt11 = await lnAddressToInvoice(profile.lud16, amount, 'zap via zappr');
      const res = await payInvoice(wallet.provider, bolt11);
      return { success: true, preimage: (res as { preimage?: string }).preimage };
    }
    case 'post_note': {
      if (!nostr.ndk) return { error: 'Nostr not connected' };
      const content = String(input.content || '');
      if (!content) return { error: 'Empty content' };
      const id = await publishNote(nostr.ndk, content);
      return { success: true, event_id: id };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
