/*
  Profile editor — publishes kind:0 metadata so the user stops being "anon"
  across every Nostr client. Merges into the latest relay-side metadata to
  avoid wiping fields we don't manage (see publishProfile).

  The Lightning address (lud16) doubles as the zap target: without it,
  nobody can zap this user's notes.
*/
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import { mono, sansBold, sansHeavy, sectionLabel, useZapprTheme } from '@/lib/theme';
import { publishProfile } from '@/lib/nostr/events';
import { useNostrStore } from '@/store/useNostrStore';
import { toast } from '@/store/useToastStore';

export default function EditProfileScreen() {
  const t = useZapprTheme();
  const { ndk, pubkey, npub, profile, setIdentity, upsertProfile } = useNostrStore();

  const [name, setName] = useState(profile?.displayName || profile?.name || '');
  const [about, setAbout] = useState(profile?.about || '');
  const [picture, setPicture] = useState(profile?.picture || '');
  const [lud16, setLud16] = useState(profile?.lud16 || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!ndk || !pubkey || !npub || saving) return;
    setSaving(true);
    try {
      const updated = await publishProfile(ndk, pubkey, {
        name: name.trim(),
        about: about.trim(),
        picture: picture.trim(),
        lud16: lud16.trim(),
      });
      setIdentity(pubkey, npub, updated);
      upsertProfile(updated);
      toast('Profile published');
      router.back();
    } catch {
      toast('Publish failed — relays may be slow, try again');
    }
    setSaving(false);
  };

  const inputStyle = {
    backgroundColor: t.surface,
    color: t.bone,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  } as const;

  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <View style={{ gap: 7 }}>
      <Text style={sectionLabel(t)}>{label}</Text>
      {node}
      {hint ? <Text style={[mono, { color: t.faint, fontSize: 10.5 }]}>{hint}</Text> : null}
    </View>
  );

  if (!pubkey) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.faint, fontSize: 12.5 }}>Log in to edit your profile.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
          <Text style={[sansHeavy, { color: t.bone, fontSize: 20, letterSpacing: -0.4 }]}>
            Edit profile
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 18, gap: 18, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Avatar
              pubkey={pubkey}
              picture={picture.trim() || undefined}
              name={name || 'anon'}
              size={72}
            />
            <Text style={[mono, { color: t.faint, fontSize: 10.5 }]}>
              preview · published to your relays
            </Text>
          </View>

          {field(
            'Display name',
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="satoshi"
              placeholderTextColor={t.faint}
              style={inputStyle}
            />,
            'How you appear in feeds and threads — instead of "anon".'
          )}
          {field(
            'About',
            <TextInput
              value={about}
              onChangeText={setAbout}
              placeholder="stacking sats in Lagos"
              placeholderTextColor={t.faint}
              multiline
              style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
            />
          )}
          {field(
            'Picture URL',
            <TextInput
              value={picture}
              onChangeText={setPicture}
              placeholder="https://…/me.jpg"
              placeholderTextColor={t.faint}
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle}
            />
          )}
          {field(
            'Lightning address',
            <TextInput
              value={lud16}
              onChangeText={setLud16}
              placeholder="you@wallet.com"
              placeholderTextColor={t.faint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={inputStyle}
            />,
            'Where zaps on your notes get paid. Without it nobody can zap you.'
          )}

          <Pressable
            onPress={save}
            disabled={saving}
            style={{
              backgroundColor: t.orange,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: saving ? 0.6 : 1,
              marginTop: 4,
            }}
          >
            {saving ? (
              <ActivityIndicator color={t.onOrange} />
            ) : (
              <Text style={[sansBold, { color: t.onOrange, fontSize: 15 }]}>Publish profile</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
