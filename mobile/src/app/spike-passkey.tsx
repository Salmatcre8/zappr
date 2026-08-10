import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mono, sectionLabel, useZapprTheme } from '@/lib/theme';
import { bytesToHex, deriveMnemonicFromPrf, deriveNsecFromPrf } from '@/lib/auth/derive';
import {
  createPasskeyNative,
  discoverPasskeyNative,
  passkeysAvailable,
  RP_ID,
} from '@/lib/auth/native-passkey';

/*
  Issue #6 prototype screen. Goal: prove that native passkey PRF with the
  web's salts derives the SAME identity as the website.

  The decisive test: enroll a passkey on https://www.usezappr.xyz in Chrome
  on this phone, then tap "Use existing passkey" here — if the npub shown
  matches the website's, web↔mobile identity parity is CONFIRMED.
*/
type SpikeResult = {
  source: string;
  npub: string;
  mnemonicPreview: string;
  prfFingerprint: string;
  credentialId: string;
};

export default function SpikePasskeyScreen() {
  const t = useZapprTheme();
  const available = passkeysAvailable();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<SpikeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (source: 'create' | 'discover') => {
    setBusy(source);
    setError(null);
    setResult(null);
    try {
      const out =
        source === 'create'
          ? await createPasskeyNative('zappr spike')
          : await discoverPasskeyNative();
      const { npub } = deriveNsecFromPrf(out.nostrPrf);
      const words = deriveMnemonicFromPrf(out.liquidPrf).split(' ');
      setResult({
        source: source === 'create' ? 'new passkey' : 'existing passkey',
        npub,
        // Enough to compare, without dumping the full secret on screen.
        mnemonicPreview: `${words[0]} ${words[1]} … ${words[11]} (12 words)`,
        prfFingerprint: bytesToHex(out.nostrPrf.slice(0, 8)),
        credentialId: out.credentialId.slice(0, 16) + '…',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
    setBusy(null);
  };

  const btn = (label: string, key: 'create' | 'discover', primary?: boolean) => (
    <Pressable
      onPress={() => run(key)}
      disabled={!available || !!busy}
      style={{
        backgroundColor: primary ? t.orange : t.panel,
        borderWidth: primary ? 0 : 1,
        borderColor: t.line,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        opacity: !available || busy ? 0.5 : 1,
      }}
    >
      {busy === key ? (
        <ActivityIndicator color={primary ? t.onOrange : t.orange} />
      ) : (
        <Text style={{ color: primary ? t.onOrange : t.bone, fontWeight: '700', fontSize: 14 }}>
          {label}
        </Text>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 34, height: 34, borderRadius: 10, borderWidth: 1,
              borderColor: t.line, backgroundColor: t.surface,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={17} color={t.bone} />
          </Pressable>
          <Text style={{ color: t.bone, fontSize: 19, fontWeight: '800' }}>
            Passkey PRF spike (#6)
          </Text>
        </View>

        <View
          style={{
            borderRadius: 16, padding: 14, backgroundColor: t.panel,
            borderWidth: 1, borderColor: t.line, gap: 6,
          }}
        >
          <Text style={sectionLabel(t)}>Status</Text>
          <Text style={{ color: available ? t.green : t.dim, fontSize: 13.5 }}>
            {available
              ? `Native passkeys available · RP ID ${RP_ID}`
              : 'Not available here — this needs the EAS development build (not Expo Go).'}
          </Text>
          <Text style={{ color: t.dim, fontSize: 12.5, lineHeight: 18 }}>
            The parity test: enroll a passkey on www.usezappr.xyz in Chrome on this phone, then
            tap "Use existing passkey". If the npub below matches the website's, one identity
            spans web and mobile.
          </Text>
        </View>

        {btn('Use existing passkey (parity test)', 'discover', true)}
        {btn('Create a new test passkey', 'create')}

        {error ? (
          <View
            style={{
              borderWidth: 1, borderColor: t.orange, backgroundColor: t.orangeSoft,
              borderRadius: 12, padding: 12,
            }}
          >
            <Text style={[mono, { color: t.orange, fontSize: 12 }]}>{error}</Text>
          </View>
        ) : null}

        {result ? (
          <View
            style={{
              borderRadius: 16, padding: 14, backgroundColor: t.panel,
              borderWidth: 1, borderColor: t.green, gap: 8,
            }}
          >
            <Text style={sectionLabel(t)}>Derived from {result.source}</Text>
            <Row label="npub" value={result.npub} mono />
            <Row label="mnemonic" value={result.mnemonicPreview} mono />
            <Row label="PRF[0..8]" value={result.prfFingerprint} mono />
            <Row label="credential" value={result.credentialId} mono />
            <Text style={{ color: t.dim, fontSize: 12, lineHeight: 17 }}>
              Compare the npub with the one the website shows for the same passkey. Match =
              parity confirmed; mismatch = document it on #6 and we fall back to the
              device-bound mnemonic path.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, mono: isMono }: { label: string; value: string; mono?: boolean }) {
  const t = useZapprTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={sectionLabel(t)}>{label}</Text>
      <Text
        selectable
        style={[isMono ? mono : null, { color: t.bone, fontSize: 12.5, lineHeight: 18 }]}
      >
        {value}
      </Text>
    </View>
  );
}
