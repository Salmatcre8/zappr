import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mono, sectionLabel, useZapprTheme } from '@/lib/theme';
import { loginWithNsec, unlockSavedIdentity } from '@/lib/session';
import { hasSecret, VAULT_KEYS } from '@/lib/vault';

/*
  Mirrors the web LoginPanel flow (web src/components/auth/LoginPanel.tsx):
  - biometric unlock first when an identity is saved on this device,
  - then the nsec form with an OPTIONAL NWC connection string,
  - "browse without logging in" as the read-only escape hatch.
  Web's "Create with FaceID / Fingerprint" (seedless passkey) only renders
  when the Breez path is available — on native that needs the #6 dev build,
  so it's a hint line here, not a dead button.
*/
export default function LoginScreen() {
  const t = useZapprTheme();
  const [hasSavedNsec, setHasSavedNsec] = useState(false);
  const [nsecInput, setNsecInput] = useState('');
  const [nwcInput, setNwcInput] = useState('');
  const [busy, setBusy] = useState<'unlock' | 'nsec' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hasSecret(VAULT_KEYS.nsec).then(setHasSavedNsec);
  }, []);

  const enter = () => router.replace('/(tabs)');

  const doUnlock = async () => {
    setBusy('unlock');
    setError(null);
    const ok = await unlockSavedIdentity();
    setBusy(null);
    if (ok) enter();
    else setError('Could not unlock the saved identity.');
  };

  const doNsecLogin = async () => {
    setBusy('nsec');
    setError(null);
    try {
      if (!nsecInput.trim().startsWith('nsec1')) {
        throw new Error('Enter a valid nsec (starts with nsec1)');
      }
      await loginWithNsec(nsecInput, nwcInput);
      enter();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    }
    setBusy(null);
  };

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
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingVertical: 28 }}
        >
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 15,
                backgroundColor: t.orange,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Text style={[mono, { color: t.onOrange, fontWeight: '700', fontSize: 24 }]}>z</Text>
            </View>
            <Text
              style={{ color: t.bone, fontSize: 25, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 }}
            >
              Welcome to zappr
            </Text>
            <Text style={{ color: t.dim, fontSize: 14.5, lineHeight: 22, marginBottom: 26 }}>
              A Lightning wallet and Nostr identity, in your language.
            </Text>

            {hasSavedNsec ? (
              <View style={{ marginBottom: 22 }}>
                <Pressable
                  onPress={doUnlock}
                  disabled={!!busy}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: 15,
                    borderRadius: 14,
                    backgroundColor: t.orange,
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {busy === 'unlock' ? (
                    <ActivityIndicator color={t.onOrange} />
                  ) : (
                    <Ionicons name="finger-print" size={18} color={t.onOrange} />
                  )}
                  <Text style={{ color: t.onOrange, fontWeight: '700', fontSize: 15 }}>
                    {busy === 'unlock' ? 'Unlocking…' : 'Unlock with biometric'}
                  </Text>
                </Pressable>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 }}
                >
                  <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
                  <Text style={sectionLabel(t)}>Or with nsec</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
                </View>
              </View>
            ) : null}

            <View style={{ gap: 16 }}>
              <View>
                <Text style={[sectionLabel(t), { marginBottom: 8 }]}>Nostr key (nsec)</Text>
                <TextInput
                  value={nsecInput}
                  onChangeText={setNsecInput}
                  placeholder="nsec1…"
                  placeholderTextColor={t.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={inputStyle}
                />
              </View>
              <View>
                <Text style={[sectionLabel(t), { marginBottom: 8 }]}>
                  NWC connection (optional)
                </Text>
                <TextInput
                  value={nwcInput}
                  onChangeText={setNwcInput}
                  placeholder="nostr+walletconnect://…"
                  placeholderTextColor={t.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={inputStyle}
                />
                <Text style={{ color: t.faint, fontSize: 11, marginTop: 6 }}>
                  Grab one from Alby, Mutiny, Primal, or any NWC-compatible wallet.
                </Text>
              </View>

              {error ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: t.orange,
                    backgroundColor: t.orangeSoft,
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <Text style={[mono, { color: t.orange, fontSize: 12 }]}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={doNsecLogin}
                disabled={!!busy || !nsecInput.trim()}
                style={{
                  backgroundColor: t.orange,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  opacity: busy || !nsecInput.trim() ? 0.5 : 1,
                }}
              >
                {busy === 'nsec' ? (
                  <ActivityIndicator color={t.onOrange} />
                ) : (
                  <Text style={{ color: t.onOrange, fontWeight: '700', fontSize: 15 }}>
                    Enter zappr
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={enter}
                disabled={!!busy}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: t.line,
                  backgroundColor: t.panel,
                  borderRadius: 12,
                  paddingVertical: 13,
                }}
              >
                <Text style={{ color: t.bone, fontWeight: '600', fontSize: 14 }}>
                  Browse without logging in
                </Text>
                <Ionicons name="arrow-forward" size={14} color={t.dim} />
              </Pressable>
            </View>

            <View style={{ gap: 6, marginTop: 24 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Ionicons name="shield-checkmark-outline" size={13} color={t.faint} style={{ marginTop: 1 }} />
                <Text style={[mono, { color: t.faint, fontSize: 11, flex: 1, lineHeight: 16 }]}>
                  Your keys never leave this device. No server.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Ionicons name="finger-print" size={13} color={t.faint} style={{ marginTop: 1 }} />
                <Text style={[mono, { color: t.faint, fontSize: 11, flex: 1, lineHeight: 16 }]}>
                  One-tap passkey wallet ("Create with FaceID / Fingerprint" on web) is coming to
                  mobile with the passkey build — issue #6.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
