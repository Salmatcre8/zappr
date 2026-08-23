/*
  Recovery phrase (APK feedback, issue 3).

  The team's tester asked the right question: "what is the recovery phrase
  actually for?" — the app showed a phrase with nowhere to use it. The honest
  answer is that with a passkey wallet the phrase is NOT the everyday login:

    passkey  → PRF → nsec  (Nostr identity)
                   → 12-word mnemonic → Spark wallet

  So the passkey reproduces both keys on every unlock, and the phrase only
  matters if the passkey is ever lost — it is the escape hatch that lets the
  sats be swept into any other BIP-39 Lightning wallet. This screen says that
  out loud and reveals the real words behind a biometric prompt.
*/
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mono, monoBold, sansBold, sansSemiBold, sectionLabel, useZapprTheme } from '@/lib/theme';
import { getSecret, VAULT_KEYS } from '@/lib/vault';
import { toast } from '@/store/useToastStore';
import { useWalletStore } from '@/store/useWalletStore';

export default function RecoveryPhraseScreen() {
  const t = useZapprTheme();
  const adapter = useWalletStore((s) => s.adapter);
  const [words, setWords] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  const reveal = async () => {
    if (busy) return;
    setBusy(true);
    const phrase = await getSecret(VAULT_KEYS.breezMnemonic, {
      gate: 'Reveal your zappr recovery phrase',
    });
    setBusy(false);
    if (!phrase) {
      // Either the gate was declined or this device has no vaulted mnemonic
      // (NWC-only accounts never had one — the funds live in that wallet).
      setMissing(true);
      return;
    }
    setWords(phrase.trim().split(/\s+/));
  };

  const copy = async () => {
    if (!words) return;
    await Clipboard.setStringAsync(words.join(' '));
    toast('Recovery phrase copied — paste it somewhere safe, then clear it');
  };

  const card = {
    backgroundColor: t.panel,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 16,
    padding: 16,
  } as const;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 18,
          paddingTop: 14,
          paddingBottom: 6,
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
        <Text style={[sansBold, { color: t.bone, fontSize: 20, letterSpacing: -0.4 }]}>
          Recovery phrase
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 40 }}>
        {/* What it is — answers the question the app never answered before. */}
        <View style={card}>
          <Text style={sectionLabel(t)}>What this is for</Text>
          <Text style={{ color: t.text2, fontSize: 13.5, lineHeight: 20, marginTop: 10 }}>
            Your passkey is your everyday login. It rebuilds both your Nostr identity and your
            wallet every time you unlock — which is why zappr never asked you to write anything
            down.
          </Text>
          <Text style={{ color: t.text2, fontSize: 13.5, lineHeight: 20, marginTop: 10 }}>
            These 12 words are the backup underneath that wallet. You need them only if you lose
            the passkey — they restore your sats in any standard Lightning or Bitcoin wallet that
            accepts a recovery phrase.
          </Text>
        </View>

        <View style={[card, { borderColor: t.orange, backgroundColor: t.orangeSoft }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="warning-outline" size={15} color={t.orange} />
            <Text style={[sansSemiBold, { color: t.bone, fontSize: 13.5 }]}>
              Anyone with these words can spend your sats
            </Text>
          </View>
          <Text style={{ color: t.text2, fontSize: 12.5, lineHeight: 19, marginTop: 8 }}>
            Never type them into a website and never send them to anyone — including someone
            claiming to be zappr support. Write them on paper rather than screenshotting them.
          </Text>
        </View>

        {words ? (
          <>
            <View style={card}>
              <Text style={sectionLabel(t)}>Your 12 words</Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  marginTop: 12,
                  rowGap: 10,
                }}
              >
                {words.map((w, i) => (
                  <View key={`${i}-${w}`} style={{ width: '50%', flexDirection: 'row', gap: 8 }}>
                    <Text
                      style={[mono, { color: t.faint, fontSize: 12, width: 20, textAlign: 'right' }]}
                    >
                      {i + 1}
                    </Text>
                    <Text style={[monoBold, { color: t.bone, fontSize: 13.5 }]}>{w}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Pressable
              onPress={copy}
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
              <Ionicons name="copy-outline" size={15} color={t.bone} />
              <Text style={[sansSemiBold, { color: t.bone, fontSize: 14 }]}>Copy phrase</Text>
            </Pressable>
          </>
        ) : missing ? (
          <View style={card}>
            <Text style={{ color: t.text2, fontSize: 13.5, lineHeight: 20 }}>
              {adapter?.kind === 'nwc'
                ? 'This account is connected to an external wallet over NWC, so zappr never held a recovery phrase for it. Back the wallet up in the app that issued your NWC connection.'
                : 'No recovery phrase is stored on this device, or the biometric check was cancelled. Sign in with your passkey first, then try again.'}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={reveal}
            disabled={busy}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              padding: 15,
              borderRadius: 14,
              backgroundColor: t.orange,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Ionicons name="finger-print" size={17} color={t.onOrange} />
            <Text style={[sansBold, { color: t.onOrange, fontSize: 15 }]}>
              {busy ? 'Checking…' : 'Reveal my phrase'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
