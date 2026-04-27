import { webln } from '@getalby/sdk';

export type NwcProvider = InstanceType<typeof webln.NostrWebLNProvider>;

export async function connectNWC(connectionString: string): Promise<NwcProvider> {
  const provider = new webln.NostrWebLNProvider({
    nostrWalletConnectUrl: connectionString,
  });
  await provider.enable();
  return provider;
}
