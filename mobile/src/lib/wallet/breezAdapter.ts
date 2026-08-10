/*
  Breez SDK Liquid on native — intentionally a stub for now.

  The real implementation uses @breeztech/react-native-breez-sdk-liquid (a
  native module), which requires:
    1. an EAS development build — it cannot load in Expo Go, and
    2. a mnemonic source, which is decided by the #6 key-derivation spike
       (passkey-PRF vs device-bound secure-enclave mnemonic).

  Keeping the class here (same WalletAdapter surface as web's breezAdapter)
  lets screens and the agent executor compile against 'breez' today and swap
  in the native SDK without touching call sites. See issues #6 and #7.
*/
import type { WalletAdapter } from './adapter';
import type { WalletTx } from '@/types/wallet';

/*
  Same convention as web's NEXT_PUBLIC_BREEZ_API_KEY: Breez ships this key
  client-side by design (config, not a secret). Set it in mobile/.env —
  see .env.example. The native SDK will read it when it lands.
*/
export const BREEZ_API_KEY = process.env.EXPO_PUBLIC_BREEZ_API_KEY ?? '';
export const breezConfigured = BREEZ_API_KEY.length > 0;

const NOT_READY =
  'The self-custodial Breez wallet needs a development build and the #6 key spike — connect an NWC wallet for now.';

export class BreezAdapter implements WalletAdapter {
  readonly kind = 'breez' as const;

  static async connect(_mnemonic: string): Promise<BreezAdapter> {
    throw new Error(NOT_READY);
  }

  async getBalance(): Promise<number> {
    throw new Error(NOT_READY);
  }

  async payInvoice(_bolt11: string): Promise<{ preimage?: string }> {
    throw new Error(NOT_READY);
  }

  async makeInvoice(_amountSats: number, _memo?: string): Promise<string> {
    throw new Error(NOT_READY);
  }

  async listTransactions(_limit?: number): Promise<WalletTx[]> {
    throw new Error(NOT_READY);
  }
}
