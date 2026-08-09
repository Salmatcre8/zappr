import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import BottomSheet from '@/components/BottomSheet';
import ConfirmSheet from '@/components/ConfirmSheet';
import { mono, sectionLabel, useZapprTheme } from '@/lib/theme';
import { timeAgo } from '@/lib/relative-time';
import { NwcAdapter } from '@/lib/wallet/nwcAdapter';
import { lnAddressToInvoice } from '@/lib/wallet/lightning';
import { getSecret, hasSecret, saveSecret, VAULT_KEYS } from '@/lib/vault';
import { useWalletStore } from '@/store/useWalletStore';
import { toast } from '@/store/useToastStore';

type Sheet = 'receive' | 'send' | 'backup' | null;

export default function WalletScreen() {
  const t = useZapprTheme();
  const {
    adapter, balance, txs, connecting, error,
    setAdapter, setBalance, setTxs, setConnecting, setError, reset,
  } = useWalletStore();

  const [nwcInput, setNwcInput] = useState('');
  const [hasSavedNwc, setHasSavedNwc] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);

  // receive
  const [recvAmount, setRecvAmount] = useState('');
  const [invoice, setInvoice] = useState<string | null>(null);
  const [makingInvoice, setMakingInvoice] = useState(false);

  // send
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [confirmSend, setConfirmSend] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);

  useEffect(() => {
    hasSecret(VAULT_KEYS.nwcUrl).then(setHasSavedNwc);
  }, [adapter]);

  const refresh = async (a = adapter) => {
    if (!a) return;
    try {
      setBalance(await a.getBalance());
      setTxs(await a.listTransactions(8));
    } catch {}
  };

  useEffect(() => {
    if (!adapter) return;
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter]);

  const connect = async (connectionString: string, persist: boolean) => {
    const trimmed = connectionString.trim();
    if (!trimmed) return;
    setConnecting(true);
    setError(null);
    try {
      const a = await NwcAdapter.connect(trimmed);
      setAdapter(a, { connectionString: trimmed });
      if (persist) await saveSecret(VAULT_KEYS.nwcUrl, trimmed);
      setNwcInput('');
      await refresh(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect — check the NWC string.');
    }
    setConnecting(false);
  };

  const reconnectSaved = async () => {
    setConnecting(true);
    setError(null);
    const saved = await getSecret(VAULT_KEYS.nwcUrl, { gate: 'Unlock your saved wallet' });
    if (saved) {
      await connect(saved, false);
    } else {
      setError('Could not unlock the saved wallet connection.');
      setConnecting(false);
    }
  };

  const makeInvoice = async () => {
    if (!adapter) return;
    const sats = parseInt(recvAmount, 10);
    if (!sats || sats <= 0) return;
    setMakingInvoice(true);
    setInvoice(null);
    try {
      setInvoice(await adapter.makeInvoice(sats, 'zappr receive'));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Invoice failed');
    }
    setMakingInvoice(false);
  };

  const approveSend = async () => {
    if (!adapter) return;
    setSendBusy(true);
    try {
      let bolt11 = sendTo.trim();
      if (bolt11.includes('@')) {
        const sats = parseInt(sendAmount, 10);
        if (!sats || sats <= 0) throw new Error('Enter an amount for a Lightning address');
        bolt11 = await lnAddressToInvoice(bolt11, sats, 'sent via zappr');
      }
      await adapter.payInvoice(bolt11);
      toast('Payment sent');
      setSendTo('');
      setSendAmount('');
      setSheet(null);
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Payment failed');
    }
    setSendBusy(false);
    setConfirmSend(false);
  };

  const isLnAddress = sendTo.includes('@');

  const actionBtn = (label: string, glyph: string, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 6,
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: t.line,
        backgroundColor: t.panel,
      }}
    >
      <Text style={{ fontSize: 17, color: t.orange }}>{glyph}</Text>
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: t.bone }}>{label}</Text>
    </Pressable>
  );

  const inputStyle = {
    backgroundColor: t.surface,
    color: t.bone,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  } as const;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View
          style={{
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: 4,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ color: t.bone, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
            Wallet
          </Text>
          <Pressable
            onPress={() => router.push('/settings')}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: t.line,
              backgroundColor: t.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="settings-outline" size={16} color={t.bone} />
          </Pressable>
        </View>

        {!adapter ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 14, gap: 12 }}>
            <View
              style={{
                borderRadius: 20,
                padding: 18,
                backgroundColor: t.panel,
                borderWidth: 1,
                borderColor: t.line,
                gap: 10,
              }}
            >
              <Text style={sectionLabel(t)}>Connect a wallet</Text>
              <Text style={{ color: t.dim, fontSize: 13.5, lineHeight: 20 }}>
                Not a custodial wallet. Paste a Nostr Wallet Connect string from Alby, Mutiny,
                Primal — anything that speaks NWC.
              </Text>
              <TextInput
                value={nwcInput}
                onChangeText={setNwcInput}
                placeholder="nostr+walletconnect://…"
                placeholderTextColor={t.faint}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                style={inputStyle}
              />
              {error ? <Text style={{ color: '#c93a2a', fontSize: 12.5 }}>{error}</Text> : null}
              <Pressable
                onPress={() => connect(nwcInput, true)}
                disabled={connecting || !nwcInput.trim()}
                style={{
                  backgroundColor: t.orange,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  opacity: connecting || !nwcInput.trim() ? 0.5 : 1,
                }}
              >
                {connecting ? (
                  <ActivityIndicator color={t.onOrange} />
                ) : (
                  <Text style={{ color: t.onOrange, fontWeight: '700', fontSize: 15 }}>
                    Connect via NWC
                  </Text>
                )}
              </Pressable>
              {hasSavedNwc ? (
                <Pressable
                  onPress={reconnectSaved}
                  disabled={connecting}
                  style={{
                    borderWidth: 1,
                    borderColor: t.line,
                    borderRadius: 12,
                    paddingVertical: 13,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: t.bone, fontWeight: '600', fontSize: 14 }}>
                    Reconnect saved wallet
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View
              style={{
                borderRadius: 16,
                padding: 14,
                backgroundColor: t.surface,
                borderWidth: 1,
                borderColor: t.line,
                gap: 6,
              }}
            >
              <Text style={sectionLabel(t)}>Start fresh (self-custodial)</Text>
              <Text style={{ color: t.dim, fontSize: 12.5, lineHeight: 18 }}>
                The seedless Breez wallet needs a development build and the #6 passkey spike —
                it's on the way. NWC works today.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
              <View
                style={{
                  borderRadius: 20,
                  padding: 18,
                  backgroundColor: t.panel,
                  borderWidth: 1,
                  borderColor: t.line,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={sectionLabel(t)}>Balance</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View
                      style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.live }}
                    />
                    <Text style={[mono, { fontSize: 10, color: t.faint }]}>LIVE</Text>
                  </View>
                </View>
                <View
                  style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 10 }}
                >
                  <Text
                    style={[
                      mono,
                      { color: t.bone, fontWeight: '700', fontSize: 38, letterSpacing: -0.8 },
                    ]}
                  >
                    {balance !== null ? balance.toLocaleString() : '—'}
                  </Text>
                  <Text style={{ color: t.dim, fontSize: 13 }}>sats</Text>
                </View>
                <Text style={{ color: t.dim, fontSize: 13, marginTop: 6 }}>
                  {adapter.kind === 'breez' ? 'Liquid · self-custodial' : 'via Nostr Wallet Connect'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 16 }}>
              {actionBtn('Receive', '↓', () => { setInvoice(null); setSheet('receive'); })}
              {actionBtn('Send', '↑', () => setSheet('send'))}
              {actionBtn('Backup', '⚿', () => setSheet('backup'))}
            </View>

            <Text
              style={[sectionLabel(t), { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 6 }]}
            >
              Recent activity
            </Text>
            <View style={{ paddingHorizontal: 18 }}>
              {txs.length === 0 ? (
                <Text style={[mono, { color: t.faint, fontSize: 11 }]}>No transactions yet</Text>
              ) : (
                txs.map((tx, i) => {
                  const incoming = tx.type === 'incoming';
                  const when = tx.settled_at || tx.created_at;
                  return (
                    <View
                      key={tx.payment_hash || i}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: t.lineSoft,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 11,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: incoming ? t.greenSoft : t.surface,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: '700',
                            color: incoming ? t.green : t.dim,
                          }}
                        >
                          {incoming ? '↓' : '↑'}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={1}
                          style={{ color: t.bone, fontSize: 14.5, fontWeight: '500' }}
                        >
                          {tx.description || (incoming ? 'Received' : 'Sent')}
                        </Text>
                        {when ? (
                          <Text style={{ color: t.faint, fontSize: 12, marginTop: 2 }}>
                            {timeAgo(when)}
                          </Text>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          mono,
                          {
                            fontSize: 14,
                            fontWeight: '700',
                            color: incoming ? t.green : t.dim,
                          },
                        ]}
                      >
                        {incoming ? '+' : '−'}
                        {tx.amount.toLocaleString()}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            <Pressable
              onPress={() => {
                reset();
                toast('Disconnected — saved connection kept');
              }}
              style={{ alignSelf: 'center', paddingVertical: 18 }}
            >
              <Text style={{ color: t.faint, fontSize: 12.5, fontWeight: '600' }}>
                Disconnect (keeps saved connection)
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* Receive sheet */}
      <BottomSheet
        visible={sheet === 'receive'}
        title="Receive sats"
        onClose={() => setSheet(null)}
      >
        {invoice ? (
          <View style={{ alignItems: 'center', gap: 14 }}>
            <View style={{ backgroundColor: '#FFFFFF', padding: 10, borderRadius: 14 }}>
              <QRCode value={invoice} size={180} />
            </View>
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(invoice);
                toast('Invoice copied');
              }}
              style={{
                borderWidth: 1,
                borderColor: t.line,
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 16,
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Text style={[mono, { color: t.bone, fontSize: 12 }]}>
                {invoice.slice(0, 28)}… · tap to copy
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <TextInput
              value={recvAmount}
              onChangeText={setRecvAmount}
              placeholder="amount (sats)"
              placeholderTextColor={t.faint}
              keyboardType="number-pad"
              style={inputStyle}
            />
            <Pressable
              onPress={makeInvoice}
              disabled={makingInvoice || !recvAmount}
              style={{
                backgroundColor: t.orange,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                opacity: makingInvoice || !recvAmount ? 0.5 : 1,
              }}
            >
              {makingInvoice ? (
                <ActivityIndicator color={t.onOrange} />
              ) : (
                <Text style={{ color: t.onOrange, fontWeight: '700', fontSize: 15 }}>
                  Generate invoice
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </BottomSheet>

      {/* Send sheet */}
      <BottomSheet visible={sheet === 'send'} title="Send sats" onClose={() => setSheet(null)}>
        <View style={{ gap: 10 }}>
          <TextInput
            value={sendTo}
            onChangeText={setSendTo}
            placeholder="Lightning address or BOLT11"
            placeholderTextColor={t.faint}
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle}
          />
          {isLnAddress ? (
            <TextInput
              value={sendAmount}
              onChangeText={setSendAmount}
              placeholder="amount (sats)"
              placeholderTextColor={t.faint}
              keyboardType="number-pad"
              style={inputStyle}
            />
          ) : null}
          <Pressable
            onPress={() => setConfirmSend(true)}
            disabled={!sendTo.trim() || (isLnAddress && !sendAmount)}
            style={{
              backgroundColor: t.orange,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              marginTop: 4,
              opacity: !sendTo.trim() || (isLnAddress && !sendAmount) ? 0.5 : 1,
            }}
          >
            <Text style={{ color: t.onOrange, fontWeight: '700', fontSize: 15 }}>Send payment</Text>
          </Pressable>
        </View>
      </BottomSheet>

      {/* Backup sheet */}
      <BottomSheet
        visible={sheet === 'backup'}
        title="Recovery phrase"
        onClose={() => setSheet(null)}
      >
        <Text style={{ color: t.dim, fontSize: 13, lineHeight: 20, marginBottom: 10 }}>
          Biometric-gated. Never leaves this device.
        </Text>
        <Text style={{ color: t.dim, fontSize: 13.5, lineHeight: 20 }}>
          A recovery phrase arrives with the self-custodial Breez wallet (issues #6 and #7). Your
          NWC connection string is already saved in the device keystore — your funds live in the
          connected wallet app, which holds its own backup.
        </Text>
      </BottomSheet>

      <ConfirmSheet
        visible={confirmSend}
        title={isLnAddress ? `Send ${Number(sendAmount || 0).toLocaleString()} sats` : 'Pay invoice'}
        rows={[
          { label: 'To', value: sendTo.trim().slice(0, 42) + (sendTo.trim().length > 42 ? '…' : '') },
          ...(isLnAddress ? [{ label: 'Amount', value: `${sendAmount} sats`, accent: true }] : []),
        ]}
        note={isLnAddress ? undefined : 'Amount is encoded in the invoice.'}
        busy={sendBusy}
        onApprove={approveSend}
        onCancel={() => setConfirmSend(false)}
      />
    </SafeAreaView>
  );
}
