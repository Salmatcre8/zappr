import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import ConfirmSheet from '@/components/ConfirmSheet';
import { mono, sansHeavy, sectionLabel, useZapprTheme } from '@/lib/theme';
import { truncateNpub } from '@/lib/nostr/keys';
import { logout } from '@/lib/session';
import { wipeAll } from '@/lib/vault';
import { useNostrStore } from '@/store/useNostrStore';
import { useWalletStore } from '@/store/useWalletStore';
import { toast } from '@/store/useToastStore';

export default function SettingsScreen() {
  const t = useZapprTheme();
  const scheme = useColorScheme();
  const { pubkey, npub, profile } = useNostrStore();
  const walletReset = useWalletStore((s) => s.reset);
  const [biometrics, setBiometrics] = useState<'on' | 'unavailable' | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const has = await LocalAuthentication.hasHardwareAsync().catch(() => false);
      const enrolled = has && (await LocalAuthentication.isEnrolledAsync().catch(() => false));
      setBiometrics(enrolled ? 'on' : 'unavailable');
    })();
  }, []);

  const doLogout = async () => {
    setBusy(true);
    await logout();
    setBusy(false);
    toast('Logged out — wallet connection kept');
    router.replace('/login');
  };

  const doWipe = async () => {
    setBusy(true);
    await wipeAll();
    await logout();
    walletReset();
    setBusy(false);
    setConfirmWipe(false);
    router.replace('/login');
  };

  const rowCard = {
    borderWidth: 1,
    borderColor: t.line,
    backgroundColor: t.panel,
    borderRadius: 16,
    padding: 14,
  } as const;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 26 }}>
        <View
          style={{
            paddingHorizontal: 14,
            paddingTop: 16,
            paddingBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Pressable
            onPress={() => router.back()}
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
            <Ionicons name="chevron-back" size={17} color={t.bone} />
          </Pressable>
          <Text style={[sansHeavy, { color: t.bone, fontSize: 19, letterSpacing: -0.4 }]}>
            Settings
          </Text>
        </View>

        <Text style={[sectionLabel(t), { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6 }]}>
          Identity
        </Text>
        <View style={{ paddingHorizontal: 18 }}>
          {pubkey && npub ? (
            <View style={[rowCard, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              <Avatar
                pubkey={pubkey}
                picture={profile?.picture}
                name={profile?.displayName || profile?.name}
                size={38}
              />
              <Text
                numberOfLines={1}
                style={[mono, { flex: 1, minWidth: 0, color: t.bone, fontSize: 13 }]}
              >
                {truncateNpub(npub, 8)}
              </Text>
              <Pressable
                onPress={async () => {
                  await Clipboard.setStringAsync(npub);
                  toast('npub copied');
                }}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: 9,
                  borderWidth: 1,
                  borderColor: t.line,
                }}
              >
                <Text style={{ color: t.dim, fontSize: 11.5, fontWeight: '600' }}>Copy</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[rowCard, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              <Text style={{ flex: 1, color: t.dim, fontSize: 14 }}>Not logged in</Text>
              <Pressable
                onPress={() => router.replace('/login')}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: 9,
                  backgroundColor: t.orange,
                }}
              >
                <Text style={{ color: t.onOrange, fontSize: 11.5, fontWeight: '700' }}>Log in</Text>
              </Pressable>
            </View>
          )}
          {pubkey ? (
            <Pressable
              onPress={() => router.push('/edit-profile')}
              style={[
                rowCard,
                {
                  marginTop: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
              ]}
            >
              <View>
                <Text style={{ color: t.bone, fontSize: 14.5, fontWeight: '500' }}>
                  Edit profile
                </Text>
                <Text style={{ color: t.faint, fontSize: 12, marginTop: 1 }}>
                  {profile?.displayName || profile?.name
                    ? 'Name, picture, Lightning address'
                    : 'You appear as "anon" — set a name so people recognize you'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={t.faint} />
            </Pressable>
          ) : null}
        </View>

        <Text style={[sectionLabel(t), { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 6 }]}>
          Appearance
        </Text>
        <View style={{ paddingHorizontal: 18 }}>
          <View
            style={[rowCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
          >
            <View>
              <Text style={{ color: t.bone, fontSize: 14.5, fontWeight: '500' }}>Appearance</Text>
              <Text style={{ color: t.faint, fontSize: 12, marginTop: 1 }}>
                {scheme === 'dark' ? 'Dark' : 'Light'} · follows system
              </Text>
            </View>
            <Text style={{ color: t.bone, fontSize: 16 }}>{scheme === 'dark' ? '☾' : '☀'}</Text>
          </View>
        </View>

        <Text style={[sectionLabel(t), { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 6 }]}>
          Security
        </Text>
        <View style={{ paddingHorizontal: 18, gap: 2 }}>
          <View
            style={[
              rowCard,
              {
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                borderBottomWidth: 0,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              },
            ]}
          >
            <Text style={{ color: t.bone, fontSize: 14.5 }}>Face ID / biometric unlock</Text>
            <Text
              style={{
                color: biometrics === 'on' ? t.green : t.faint,
                fontSize: 12.5,
                fontWeight: '600',
              }}
            >
              {biometrics === 'on' ? 'On' : biometrics === 'unavailable' ? 'Unavailable' : '…'}
            </Text>
          </View>
          <Pressable
            onPress={() => toast('Recovery phrase arrives with the Breez wallet (#6/#7)')}
            style={[
              rowCard,
              {
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                borderBottomWidth: 0,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              },
            ]}
          >
            <Text style={{ color: t.bone, fontSize: 14.5 }}>Recovery phrase</Text>
            <Ionicons name="chevron-forward" size={14} color={t.faint} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/spike-passkey')}
            style={[
              rowCard,
              {
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              },
            ]}
          >
            <Text style={{ color: t.bone, fontSize: 14.5 }}>Passkey PRF spike (#6)</Text>
            <Ionicons name="chevron-forward" size={14} color={t.faint} />
          </Pressable>
        </View>

        {pubkey ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 28 }}>
            <Pressable
              onPress={doLogout}
              disabled={busy}
              style={{
                paddingVertical: 15,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(220,60,45,0.35)',
                backgroundColor: 'rgba(220,60,45,0.08)',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#c93a2a', fontWeight: '700', fontSize: 15 }}>Log out</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
          <Pressable
            onPress={() => setConfirmWipe(true)}
            style={{ paddingVertical: 12, alignItems: 'center' }}
          >
            <Text style={{ color: t.faint, fontSize: 12.5, fontWeight: '600' }}>
              Wipe device data
            </Text>
          </Pressable>
        </View>

        <Text style={{ color: t.faint, fontSize: 11.5, textAlign: 'center', paddingTop: 16 }}>
          zappr · v0.1 · self-custodial
        </Text>
      </ScrollView>

      <ConfirmSheet
        visible={confirmWipe}
        title="Wipe device data"
        rows={[
          { label: 'Removes', value: 'identity key' },
          { label: 'Removes', value: 'wallet connection' },
        ]}
        note="This deletes every zappr secret from this device. If you haven't backed up your nsec elsewhere, you will lose this identity permanently."
        busy={busy}
        onApprove={doWipe}
        onCancel={() => setConfirmWipe(false)}
      />
    </SafeAreaView>
  );
}
