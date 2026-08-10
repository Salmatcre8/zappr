/*
  Breez SDK Liquid wallet adapter — the NATIVE counterpart of web
  src/lib/wallet/breezAdapter.ts. The 12-word mnemonic comes from the vault
  (passkey-derived via PRF, or generated on-device) — same seedless model.

  Requires the dev build (native module — not Expo Go), and
  EXPO_PUBLIC_BREEZ_API_KEY in mobile/.env (Breez ships the key client-side
  by design; when running through Metro the env is inlined at serve time).

  Docs: https://sdk-doc-liquid.breez.technology/
*/
import {
  connect,
  defaultConfig,
  disconnect as breezDisconnect,
  getInfo,
  listPayments,
  LiquidNetwork,
  PaymentMethod,
  prepareReceivePayment,
  prepareSendPayment,
  receivePayment,
  sendPayment,
} from '@breeztech/react-native-breez-sdk-liquid';
import type { WalletAdapter } from './adapter';
import type { WalletTx } from '@/types/wallet';

export const BREEZ_API_KEY = process.env.EXPO_PUBLIC_BREEZ_API_KEY ?? '';
export const breezConfigured = BREEZ_API_KEY.length > 0;

// The RN SDK is a module-level singleton — one connection at a time.
let connected = false;

export class BreezAdapter implements WalletAdapter {
  readonly kind = 'breez' as const;

  static async connect(mnemonic: string): Promise<BreezAdapter> {
    if (!breezConfigured) {
      throw new Error(
        'EXPO_PUBLIC_BREEZ_API_KEY is not set — add it to mobile/.env and restart Metro'
      );
    }
    if (connected) return new BreezAdapter();
    const config = await defaultConfig(LiquidNetwork.MAINNET, BREEZ_API_KEY);
    await connect({ config, mnemonic });
    connected = true;
    return new BreezAdapter();
  }

  async getBalance(): Promise<number> {
    const info = await getInfo();
    return info.walletInfo.balanceSat;
  }

  async payInvoice(bolt11: string): Promise<{ preimage?: string }> {
    const prepareResponse = await prepareSendPayment({ destination: bolt11 });
    const res = await sendPayment({ prepareResponse });
    const details = res.payment?.details as { preimage?: string } | undefined;
    return { preimage: details?.preimage };
  }

  async makeInvoice(amountSats: number, memo?: string): Promise<string> {
    const prepareResponse = await prepareReceivePayment({
      paymentMethod: PaymentMethod.LIGHTNING,
      amount: { type: 'bitcoin', payerAmountSat: amountSats } as never,
    });
    const res = await receivePayment({
      prepareResponse,
      description: memo,
    });
    return res.destination;
  }

  async listTransactions(limit = 10): Promise<WalletTx[]> {
    try {
      const list = await listPayments({ limit });
      return list.map((p): WalletTx => {
        const details = p.details as { description?: string } | undefined;
        return {
          type: p.paymentType === 'send' ? 'outgoing' : 'incoming',
          amount: p.amountSat ?? 0,
          fees_paid: p.feesSat,
          created_at: p.timestamp ?? Math.floor(Date.now() / 1000),
          description: details?.description,
          payment_hash: p.txId,
          settled_at: p.status === 'complete' ? p.timestamp : undefined,
        };
      });
    } catch {
      return [];
    }
  }

  async disconnect(): Promise<void> {
    try {
      await breezDisconnect();
    } catch {}
    connected = false;
  }
}
