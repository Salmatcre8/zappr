/*
  Breez SDK Spark wallet adapter — the default self-custodial backend.

  Spark settles Lightning natively (no Boltz swap provider in the path),
  which keeps receive/send working while Boltz has swap creation paused
  service-wide (Aug 2026, no ETA). The Liquid adapter (breezAdapter.ts)
  stays around for sweeping funds off Liquid once Boltz returns.

  Runs entirely in the browser via WASM. The 12-word mnemonic is derived
  from the user's passkey on every unlock — we never persist it. Wallet
  state lives in IndexedDB under the storageDir name.

  Docs: https://sdk-doc-spark.breez.technology/
*/

import type { WalletAdapter } from './adapter';
import type { WalletTx } from '@/types/wallet';
import type { BreezSdk, Payment } from '@breeztech/breez-sdk-spark';

export class SparkAdapter implements WalletAdapter {
  readonly kind = 'spark' as const;
  constructor(private sdk: BreezSdk) {}

  static async connect(mnemonic: string): Promise<SparkAdapter> {
    const apiKey = process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    if (!apiKey) {
      throw new Error('NEXT_PUBLIC_BREEZ_API_KEY is not configured');
    }

    // Dynamic import keeps the ~11 MB WASM out of the SSR bundle; the
    // default export instantiates the module (idempotent).
    const breez = await import('@breeztech/breez-sdk-spark');
    await breez.default();

    const config = breez.defaultConfig('mainnet');
    config.apiKey = apiKey;
    const sdk = await breez.connect({
      config,
      seed: { type: 'mnemonic', mnemonic },
      storageDir: 'zappr-spark',
    });
    return new SparkAdapter(sdk);
  }

  async getBalance(): Promise<number> {
    const info = await this.sdk.getInfo({});
    return Number(info.balanceSats);
  }

  async payInvoice(bolt11: string): Promise<{ preimage?: string }> {
    const prepareResponse = await this.sdk.prepareSendPayment({
      paymentRequest: { type: 'input', input: bolt11 },
    });
    await this.sdk.sendPayment({
      prepareResponse,
      options: { type: 'bolt11Invoice', preferSpark: false, completionTimeoutSecs: 30 },
    });
    return {};
  }

  async makeInvoice(amountSats: number, memo?: string): Promise<string> {
    const res = await this.sdk.receivePayment({
      paymentMethod: {
        type: 'bolt11Invoice',
        description: memo ?? '',
        amountSats,
        expirySecs: 3600,
      },
    });
    return res.paymentRequest;
  }

  async listTransactions(limit = 10): Promise<WalletTx[]> {
    try {
      const res = await this.sdk.listPayments({ offset: 0, limit });
      return res.payments.map((p: Payment): WalletTx => ({
        type: p.paymentType === 'send' ? 'outgoing' : 'incoming',
        amount: Number(p.amount),
        fees_paid: Number(p.fees),
        created_at: p.timestamp,
        description: p.details?.type === 'lightning' ? p.details.description : undefined,
        payment_hash: p.id,
        settled_at: p.status === 'completed' ? p.timestamp : undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Unified Lightning address — registration is built into the SDK
   * (user@breez.tips by default; lnurlDomain config can point it at our
   * own domain once we host the LNURL service).
   */
  async lightningAddress(): Promise<string | null> {
    const info = await this.sdk.getLightningAddress();
    return info?.lightningAddress ?? null;
  }

  async registerLightningAddress(username: string): Promise<string> {
    const info = await this.sdk.registerLightningAddress({
      username,
      description: 'zappr wallet',
    });
    return info.lightningAddress;
  }

  async disconnect(): Promise<void> {
    try {
      await this.sdk.disconnect();
    } catch {}
  }
}
