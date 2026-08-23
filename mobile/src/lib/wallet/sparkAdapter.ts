/*
  Breez SDK Spark wallet adapter — replaces the Liquid adapter as the default
  self-custodial backend. Spark settles Lightning natively (no Boltz swap
  provider), which is what un-blocks receive/send while Boltz has swap
  creation paused service-wide (Aug 2026, no ETA).

  Same seedless model: the 12-word mnemonic comes from the vault
  (passkey-derived via PRF, or generated on-device). The old Liquid adapter
  (breezAdapter.ts) is kept for sweeping any funds left on Liquid once Boltz
  is back.

  Requires the dev build (native module — not Expo Go) and
  EXPO_PUBLIC_BREEZ_API_KEY in mobile/.env (Breez ships the key client-side
  by design).

  Docs: https://sdk-doc-spark.breez.technology/
*/
import type { WalletAdapter } from './adapter';
import type { WalletTx } from '@/types/wallet';
import {
  connect,
  defaultConfig,
  Network,
  PaymentDetails,
  PaymentRequest,
  PaymentStatus,
  PaymentType,
  ReceivePaymentMethod,
  Seed,
  SendPaymentOptions,
  type BreezSdkInterface,
  type Payment,
} from '@breeztech/breez-sdk-spark-react-native';
import * as FileSystem from 'expo-file-system/legacy';

export const BREEZ_API_KEY = process.env.EXPO_PUBLIC_BREEZ_API_KEY ?? '';
export const sparkConfigured = BREEZ_API_KEY.length > 0;

// One SDK instance per app — reconnecting with the same seed is a no-op.
let sdk: BreezSdkInterface | null = null;

function storageDir(): string {
  const base = FileSystem.documentDirectory ?? '';
  return `${base.replace(/^file:\/\//, '')}breez-spark`;
}

function txOf(p: Payment): WalletTx {
  const lightning =
    p.details && PaymentDetails.Lightning.instanceOf(p.details) ? p.details.inner : undefined;
  return {
    type: p.paymentType === PaymentType.Send ? 'outgoing' : 'incoming',
    amount: Number(p.amount),
    fees_paid: Number(p.fees),
    created_at: Number(p.timestamp),
    description: lightning?.description,
    payment_hash: p.id,
    settled_at: p.status === PaymentStatus.Completed ? Number(p.timestamp) : undefined,
  };
}

export class SparkAdapter implements WalletAdapter {
  readonly kind = 'spark' as const;

  static async connect(mnemonic: string): Promise<SparkAdapter> {
    if (!sparkConfigured) {
      throw new Error(
        'EXPO_PUBLIC_BREEZ_API_KEY is not set — add it to mobile/.env and restart Metro'
      );
    }
    if (sdk) return new SparkAdapter();
    const config = { ...defaultConfig(Network.Mainnet), apiKey: BREEZ_API_KEY };
    sdk = await connect({
      config,
      seed: new Seed.Mnemonic({ mnemonic, passphrase: undefined }),
      storageDir: storageDir(),
    });
    return new SparkAdapter();
  }

  private get instance(): BreezSdkInterface {
    if (!sdk) throw new Error('Spark wallet is not connected');
    return sdk;
  }

  async getBalance(): Promise<number> {
    const info = await this.instance.getInfo({ ensureSynced: false });
    return Number(info.balanceSats);
  }

  async payInvoice(bolt11: string): Promise<{ preimage?: string }> {
    const prepareResponse = await this.instance.prepareSendPayment({
      paymentRequest: new PaymentRequest.Input({ input: bolt11 }),
      amount: undefined,
      tokenIdentifier: undefined,
      conversionOptions: undefined,
      feePolicy: undefined,
    });
    await this.instance.sendPayment({
      prepareResponse,
      options: new SendPaymentOptions.Bolt11Invoice({
        preferSpark: false,
        completionTimeoutSecs: 30,
      }),
      idempotencyKey: undefined,
    });
    return {};
  }

  async makeInvoice(amountSats: number, memo?: string): Promise<string> {
    const res = await this.instance.receivePayment({
      paymentMethod: new ReceivePaymentMethod.Bolt11Invoice({
        description: memo ?? '',
        amountSats: BigInt(amountSats),
        expirySecs: 3600,
        paymentHash: undefined,
      }),
    });
    return res.paymentRequest;
  }

  async listTransactions(limit = 10): Promise<WalletTx[]> {
    try {
      const res = await this.instance.listPayments({
        typeFilter: undefined,
        statusFilter: undefined,
        assetFilter: undefined,
        paymentDetailsFilter: undefined,
        fromTimestamp: undefined,
        toTimestamp: undefined,
        offset: undefined,
        limit,
        sortAscending: false,
      });
      return res.payments.map(txOf);
    } catch {
      return [];
    }
  }

  /**
   * Unified Lightning address (user@breez.tips today; custom domain is a
   * config option later). Registration is idempotent per wallet.
   */
  async lightningAddress(): Promise<string | null> {
    const info = await this.instance.getLightningAddress();
    return info?.lightningAddress ?? null;
  }

  async registerLightningAddress(username: string): Promise<string> {
    const info = await this.instance.registerLightningAddress({
      username,
      description: 'zappr wallet',
    });
    return info.lightningAddress;
  }

  async disconnect(): Promise<void> {
    try {
      await this.instance.disconnect();
    } catch {}
    sdk = null;
  }
}
