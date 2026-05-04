/*
  Breez SDK Liquid wallet adapter.

  Runs entirely in the browser via WASM. The 12-word mnemonic is derived
  from the user's passkey on every unlock — we never persist it.

  Docs: https://sdk-doc-liquid.breez.technology/
*/

import type { WalletAdapter } from './adapter';
import type { WalletTx } from '@/types/wallet';

// Lazily-initialised handle to the WASM module so SSR doesn't try to load it.
type BreezSdk = {
  getInfo(): Promise<{ walletInfo: { balanceSat: number } }>;
  prepareSendPayment(req: { destination: string }): Promise<{ feesSat: number }>;
  sendPayment(req: { prepareResponse: unknown; payerNote?: string }): Promise<{
    payment: { preimage?: string };
  }>;
  prepareReceivePayment(req: {
    paymentMethod: 'bolt11Invoice';
    amount: { type: 'bitcoin'; payerAmountSat: number };
  }): Promise<{ feesSat: number }>;
  receivePayment(req: {
    prepareResponse: unknown;
    description?: string;
  }): Promise<{ destination: string }>;
  listPayments(req?: { limit?: number }): Promise<BreezPayment[]>;
  disconnect(): Promise<void>;
};

type BreezPayment = {
  paymentType?: 'send' | 'receive';
  amountSat?: number;
  feesSat?: number;
  timestamp?: number;
  description?: string;
  txId?: string;
  status?: string;
};

export class BreezAdapter implements WalletAdapter {
  readonly kind = 'breez' as const;
  constructor(private sdk: BreezSdk) {}

  static async connect(mnemonic: string): Promise<BreezAdapter> {
    const apiKey = process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    if (!apiKey) {
      throw new Error('NEXT_PUBLIC_BREEZ_API_KEY is not configured');
    }

    // Dynamic import keeps the WASM out of the SSR bundle.
    const breez = await import('@breeztech/breez-sdk-liquid');
    // The web build exports `init` as default. Calling it loads the WASM.
    const init = (breez as unknown as { default?: () => Promise<unknown> }).default;
    if (typeof init === 'function') await init();

    const config = breez.defaultConfig('mainnet', apiKey);
    const sdk = (await breez.connect({ mnemonic, config })) as unknown as BreezSdk;
    return new BreezAdapter(sdk);
  }

  async getBalance(): Promise<number> {
    const info = await this.sdk.getInfo();
    return info.walletInfo.balanceSat;
  }

  async payInvoice(bolt11: string): Promise<{ preimage?: string }> {
    const prepared = await this.sdk.prepareSendPayment({ destination: bolt11 });
    const res = await this.sdk.sendPayment({ prepareResponse: prepared });
    return { preimage: res.payment?.preimage };
  }

  async makeInvoice(amountSats: number, memo?: string): Promise<string> {
    const prepared = await this.sdk.prepareReceivePayment({
      paymentMethod: 'bolt11Invoice',
      amount: { type: 'bitcoin', payerAmountSat: amountSats },
    });
    const res = await this.sdk.receivePayment({
      prepareResponse: prepared,
      description: memo,
    });
    return res.destination;
  }

  async listTransactions(limit = 10): Promise<WalletTx[]> {
    try {
      const list = await this.sdk.listPayments({ limit });
      return list.map((p): WalletTx => ({
        type: p.paymentType === 'send' ? 'outgoing' : 'incoming',
        amount: p.amountSat ?? 0,
        fees_paid: p.feesSat,
        created_at: p.timestamp ?? Math.floor(Date.now() / 1000),
        description: p.description,
        payment_hash: p.txId,
        settled_at: p.status === 'complete' ? p.timestamp : undefined,
      }));
    } catch {
      return [];
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.sdk.disconnect();
    } catch {}
  }
}
