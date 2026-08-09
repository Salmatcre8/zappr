import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mono, sectionLabel, useZapprTheme } from '@/lib/theme';
import { loginWithNsec, unlockSavedIdentity } from '@/lib/session';
import { hasSecret, VAULT_KEYS } from '@/lib/vault';
import { toast } from '@/store/useToastStore';

export default function LoginScreen() {
  const t = useZapprTheme();
  const [hasSavedNsec, setHasSavedNsec] = useState(false);
  const [showNsec, setShowNsec] = useState(false);
  const [nsecInput, setNsecInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hasSecret(VAULT_KEYS.nsec).then(setHasSavedNsec);
  }, []);

  const enter = () => router.replace('/(tabs)');

  const doUnlock = async () => {
    setBusy(true);
    setError(null);
    const ok = await unlockSavedIdentity();
    setBusy(false);
    if (ok) enter();
    else setError('Could not unlock the saved identity.');
  };

  const doNsecLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await loginWithNsec(nsecInput);
      enter();
    } catch {
      setError('That does not look like a valid nsec.');
    }
    setBusy(false);
  };

  const paths = [
    ...(hasSavedNsec
      ? [
          {
            mark: '⊙',
            title: 'Unlock with biometric',
            sub: 'Open your saved identity from the device vault',
            onPress: doUnlock,
          },
        ]
      : []),
    {
      mark: '#',
      title: 'Enter nsec',
      sub: 'Paste an nsec1… — stored in the device keystore',
      onPress: () => setShowNsec((v) => !v),
    },
    {
      mark: '→',
      title: 'Browse without logging in',
      sub: 'Read the global feed; connect a wallet anytime',
      onPress: enter,
    },
  ];

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
            <Text style={{ color: t.dim, fontSize: 14.5, lineHeight: 22, marginBottom: 30 }}>
              A Lightning wallet and Nostr identity, in your language.
            </Text>

            <Pressable
              onPress={() =>
                toast('Seedless onboarding needs the #6 passkey build — use nsec for now')
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 13,
                padding: 16,
                borderRadius: 16,
                backgroundColor: t.orange,
                marginBottom: 22,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={[mono, { color: t.onOrange, fontWeight: '700', fontSize: 15 }]}>ID</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.onOrange, fontWeight: '700', fontSize: 15 }}>
                  Create with Face ID
                </Text>
                <Text style={{ color: t.onOrange, opacity: 0.88, fontSize: 12, marginTop: 1 }}>
                  Seedless — one tap, no recovery phrase
                </Text>
              </View>
              <Text style={{ color: t.onOrange, opacity: 0.8, fontSize: 16 }}>→</Text>
            </Pressable>

            <Text style={[sectionLabel(t), { marginBottom: 11 }]}>Or continue with</Text>
            <View style={{ gap: 8 }}>
              {paths.map((p) => (
                <Pressable
                  key={p.title}
                  onPress={p.onPress}
                  disabled={busy}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    borderRadius: 13,
                    borderWidth: 1,
                    borderColor: t.line,
                    backgroundColor: t.panel,
                  }}
                >
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      backgroundColor: t.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={[mono, { color: t.dim, fontWeight: '700', fontSize: 12 }]}>
                      {p.mark}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.bone, fontWeight: '600', fontSize: 14 }}>{p.title}</Text>
                    <Text style={{ color: t.dim, fontSize: 11.5, marginTop: 1 }}>{p.sub}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {showNsec ? (
              <View style={{ gap: 8, marginTop: 12 }}>
                <TextInput
                  value={nsecInput}
                  onChangeText={setNsecInput}
                  placeholder="nsec1…"
                  placeholderTextColor={t.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={{
                    backgroundColor: t.surface,
                    color: t.bone,
                    borderWidth: 1,
                    borderColor: t.line,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    fontSize: 15,
                  }}
                />
                <Pressable
                  onPress={doNsecLogin}
                  disabled={busy || !nsecInput.trim()}
                  style={{
                    backgroundColor: t.orange,
                    borderRadius: 12,
                    paddingVertical: 14,
                    alignItems: 'center',
                    opacity: busy || !nsecInput.trim() ? 0.5 : 1,
                  }}
                >
                  {busy ? (
                    <ActivityIndicator color={t.onOrange} />
                  ) : (
                    <Text style={{ color: t.onOrange, fontWeight: '700', fontSize: 15 }}>
                      Continue
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {error ? (
              <Text style={{ color: t.orange, fontSize: 12, marginTop: 10 }}>{error}</Text>
            ) : null}
          </View>

          <Text style={{ color: t.faint, fontSize: 11.5, textAlign: 'center', paddingTop: 14 }}>
            Self-custodial — your keys never leave this device
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
