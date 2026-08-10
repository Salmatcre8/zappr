import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  mono, monoBold, sansBold, sansSemiBold, sectionLabel, useZapprTheme,
} from '@/lib/theme';
import { loginWithNsec, loginWithPasskey, unlockSavedIdentity } from '@/lib/session';
import { passkeysAvailable } from '@/lib/auth/native-passkey';
import { hasSecret, VAULT_KEYS } from '@/lib/vault';
import { toast } from '@/store/useToastStore';

/*
  Mirrors the web LoginPanel (web src/components/auth/LoginPanel.tsx):
  1. "Create with FaceID / Fingerprint" + "I already have a passkey wallet"
     — the beginner path, top when no vault exists. REAL on the dev build
     (native passkeys + PRF, issue #6); explains itself in Expo Go.
  2. "Unlock with biometric" when an identity is saved on this device.
  3. nsec + optional NWC string.
  4. Browse-only escape hatch.
*/
type Busy = 'fresh' | 'recover' | 'unlock' | 'nsec' | null;

export default function LoginScreen() {
  const t = useZapprTheme();
  const [hasSavedNsec, setHasSavedNsec] = useState(false);
  const [nsecInput, setNsecInput] = useState('');
  const [nwcInput, setNwcInput] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const nativePasskeys = passkeysAvailable();

  useEffect(() => {
    hasSecret(VAULT_KEYS.nsec).then(setHasSavedNsec);
  }, []);

  const enter = () => router.replace('/(tabs)');

  const doPasskey = async (create: boolean) => {
    if (!nativePasskeys) {
      toast('Passkeys need the dev-build app — install it from the EAS build link');
      return;
    }
    setBusy(create ? 'fresh' : 'recover');
    setError(null);
    try {
      await loginWithPasskey(create);
      enter();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Passkey failed');
    }
    setBusy(null);
  };

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

  const primaryBtn = (disabled: boolean) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    padding: 15,
    borderRadius: 14,
    backgroundColor: t.orange,
    opacity: disabled ? 0.6 : 1,
  });

  const ghostBtn = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    borderWidth: 1,
    borderColor: t.line,
    backgroundColor: t.panel,
    borderRadius: 12,
    paddingVertical: 13,
  };

  const divider = (label: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
      <Text style={sectionLabel(t)}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
    </View>
  );

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
            {/* Brand header — matches the web login: ⚡ mark + mono wordmark */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 26 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 15,
                  backgroundColor: t.orange,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="flash" size={26} color={t.onOrange} />
              </View>
              <View>
                <Text style={[monoBold, { color: t.bone, fontSize: 30, lineHeight: 34 }]}>
                  zappr
                </Text>
                <Text style={[mono, { color: t.faint, fontSize: 10, letterSpacing: 2 }]}>
                  BITCOIN · NOSTR · AI
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: t.panel,
                borderWidth: 1,
                borderColor: t.line,
                borderRadius: 16,
                padding: 18,
              }}
            >
              {!hasSavedNsec ? (
                <>
                  <Pressable
                    onPress={() => doPasskey(true)}
                    disabled={!!busy}
                    style={primaryBtn(!!busy)}
                  >
                    {busy === 'fresh' ? (
                      <ActivityIndicator color={t.onOrange} />
                    ) : (
                      <Ionicons name="sparkles" size={16} color={t.onOrange} />
                    )}
                    <Text style={[sansBold, { color: t.onOrange, fontSize: 15 }]}>
                      {busy === 'fresh' ? 'Creating wallet…' : 'Create with Passkey'}
                    </Text>
                  </Pressable>
                  <Text style={[mono, { color: t.faint, fontSize: 10.5, lineHeight: 16, marginTop: 8 }]}>
                    New to Bitcoin? One tap creates a self-custodial Lightning wallet and Nostr
                    identity. No seed phrase. No keys to copy.
                  </Text>

                  <Pressable
                    onPress={() => doPasskey(false)}
                    disabled={!!busy}
                    style={[ghostBtn, { marginTop: 12 }]}
                  >
                    {busy === 'recover' ? (
                      <ActivityIndicator color={t.orange} />
                    ) : (
                      <Ionicons name="finger-print" size={16} color={t.bone} />
                    )}
                    <Text style={[sansSemiBold, { color: t.bone, fontSize: 14 }]}>
                      {busy === 'recover' ? 'Recovering…' : 'I already have a passkey wallet'}
                    </Text>
                  </Pressable>

                  {divider('Or use an existing identity')}
                </>
              ) : (
                <>
                  <Pressable onPress={doUnlock} disabled={!!busy} style={primaryBtn(!!busy)}>
                    {busy === 'unlock' ? (
                      <ActivityIndicator color={t.onOrange} />
                    ) : (
                      <Ionicons name="finger-print" size={17} color={t.onOrange} />
                    )}
                    <Text style={[sansBold, { color: t.onOrange, fontSize: 15 }]}>
                      {busy === 'unlock' ? 'Unlocking…' : 'Unlock with biometric'}
                    </Text>
                  </Pressable>
                  {divider('Or with nsec')}
                </>
              )}

              <View style={{ gap: 16 }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="key-outline" size={12} color={t.dim} />
                    <Text style={sectionLabel(t)}>Nostr key (nsec)</Text>
                  </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="wallet-outline" size={12} color={t.dim} />
                    <Text style={sectionLabel(t)}>NWC connection (optional)</Text>
                  </View>
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
                  <Text style={[mono, { color: t.faint, fontSize: 10, marginTop: 6 }]}>
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
                    <Text style={[sansBold, { color: t.onOrange, fontSize: 15 }]}>Enter zappr</Text>
                  )}
                </Pressable>

                <Pressable onPress={enter} disabled={!!busy} style={ghostBtn}>
                  <Text style={[sansSemiBold, { color: t.bone, fontSize: 14 }]}>
                    Browse without logging in
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={t.dim} />
                </Pressable>
              </View>

              <View style={{ gap: 6, marginTop: 18 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Ionicons name="shield-checkmark-outline" size={13} color={t.faint} style={{ marginTop: 1 }} />
                  <Text style={[mono, { color: t.faint, fontSize: 10.5, flex: 1, lineHeight: 16 }]}>
                    Your keys never leave this device. No server.
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Ionicons name="finger-print" size={13} color={t.faint} style={{ marginTop: 1 }} />
                  <Text style={[mono, { color: t.faint, fontSize: 10.5, flex: 1, lineHeight: 16 }]}>
                    {hasSavedNsec
                      ? 'Biometric vault enrolled on this device.'
                      : nativePasskeys
                        ? 'Tap above to create a wallet from your fingerprint — no seed phrase needed.'
                        : 'Passkey buttons need the dev-build app (Expo Go cannot do native passkeys).'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
