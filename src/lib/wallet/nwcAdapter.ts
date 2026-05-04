import { webln } from '@getalby/sdk';
import type { WalletAdapter } from './adapter';
import type { WalletTx } from '@/types/wallet';

type NwcProvider = InstanceType<typeof webln.NostrWebLNProvider>;

export class NwcAdapter implements WalletAdapter {
  readonly kind = 'nwc' as const;
  constructor(private provider: NwcProvider) {}

  static async connect(connectionString: string): Promise<NwcAdapter> {
    const provider = new webln.NostrWebLNProvider({ nostrWalletConnectUrl: connectionString });
    await provider.enable();
    return new NwcAdapter(provider);
  }

  async getBalance(): Promise<number> {
    const res = await this.provider.getBalance();
    return Math.floor(res.balance);
  }

  async payInvoice(bolt11: string): Promise<{ preimage?: string }> {
    const res = await this.provider.sendPayment(bolt11);
    return { preimage: res?.preimage };
  }

  async makeInvoice(amountSats: number, memo?: string): Promise<string> {
    const res = await this.provider.makeInvoice({ amount: amountSats, defaultMemo: memo });
    return res.paymentRequest;
  }

  async listTransactions(limit = 10): Promise<WalletTx[]> {
    try {
      const res = await (
        this.provider as unknown as { listTransactions?: (o: { limit: number }) => Promise<{ transactions?: WalletTx[] }> }
      ).listTransactions?.({ limit });
      return (res?.transactions || []) as WalletTx[];
    } catch {
      return [];
    }
  }
}
