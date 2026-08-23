/*
  Profile page: who you are on Nostr plus what you've engaged with —
  your posts, the notes you liked, and the ones you reposted. Entry
  points: the avatar in the feed header and the identity card in Settings.
*/
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import NoteRow from '@/components/NoteRow';
import { mono, sans, sansHeavy, sansSemiBold, useZapprTheme } from '@/lib/theme';
import { fetchEngagedNotes, fetchFeed, fetchProfiles } from '@/lib/nostr/events';
import { truncateNpub } from '@/lib/nostr/keys';
import { useNostrStore } from '@/store/useNostrStore';
import type { FeedNote } from '@/types/nostr';

type Tab = 'posts' | 'likes' | 'reposts';
const TABS: { key: Tab; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'likes', label: 'Likes' },
  { key: 'reposts', label: 'Reposts' },
];

export default function ProfileScreen() {
  const t = useZapprTheme();
  const { ndk, pubkey, npub, profile, profiles, upsertProfiles } = useNostrStore();
  const [tab, setTab] = useState<Tab>('posts');
  const [notes, setNotes] = useState<Record<Tab, FeedNote[] | null>>({
    posts: null,
    likes: null,
    reposts: null,
  });
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (which: Tab) => {
      if (!ndk || !pubkey) return;
      setLoading(true);
      try {
        const found =
          which === 'posts'
            ? await fetchFeed(ndk, [pubkey], 30)
            : await fetchEngagedNotes(ndk, pubkey, which === 'likes' ? 7 : 6, 30);
        setNotes((n) => ({ ...n, [which]: found }));
        const missing = Array.from(new Set(found.map((n) => n.pubkey))).filter(
          (p) => !profiles[p]
        );
        if (missing.length) {
          const profs = await fetchProfiles(ndk, missing);
          if (Object.keys(profs).length) upsertProfiles(profs);
        }
      } catch {
        setNotes((n) => ({ ...n, [which]: n[which] ?? [] }));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ndk, pubkey]
  );

  useEffect(() => {
    if (notes[tab] === null) load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const openThread = useCallback(
    (note: FeedNote) => router.push({ pathname: '/note/[id]', params: { id: note.id } }),
    []
  );

  if (!pubkey || !npub) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.faint, fontSize: 12.5 }}>Log in to see your profile.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const name = profile?.displayName || profile?.name;
  const current = notes[tab];

  const header = (
    <View style={{ paddingHorizontal: 18, paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar pubkey={pubkey} picture={profile?.picture} name={name || 'anon'} size={64} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[sansHeavy, { color: t.bone, fontSize: 20 }]}>
            {name || 'anon'}
          </Text>
          <Text numberOfLines={1} style={[mono, { color: t.faint, fontSize: 11, marginTop: 2 }]}>
            {truncateNpub(npub, 10)}
          </Text>
          {profile?.lud16 ? (
            <Text numberOfLines={1} style={[mono, { color: t.orange, fontSize: 11, marginTop: 2 }]}>
              ⚡ {profile.lud16}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => router.push('/edit-profile')}
          style={{
            paddingHorizontal: 13,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: t.line,
          }}
        >
          <Text style={{ color: t.dim, fontSize: 12.5, fontWeight: '600' }}>Edit</Text>
        </Pressable>
      </View>
      {profile?.about ? (
        <Text style={[sans, { color: t.text2, fontSize: 13.5, lineHeight: 20, marginTop: 12 }]}>
          {profile.about}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        {TABS.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={{
              paddingHorizontal: 15,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: tab === key ? 'transparent' : t.line,
              backgroundColor: tab === key ? t.orange : 'transparent',
            }}
          >
            <Text
              style={[
                sansSemiBold,
                { fontSize: 12.5, color: tab === key ? t.onOrange : t.dim },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 18,
          paddingTop: 14,
          paddingBottom: 14,
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
          Profile
        </Text>
      </View>

      <FlatList
        data={current ?? []}
        keyExtractor={(n) => n.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <NoteRow
            note={item}
            profile={profiles[item.pubkey]}
            zapAmount={21}
            onOpen={openThread}
          />
        )}
        ListEmptyComponent={
          loading || current === null ? (
            <ActivityIndicator color={t.orange} style={{ marginTop: 32 }} />
          ) : (
            <Text style={{ color: t.faint, fontSize: 12, textAlign: 'center', marginTop: 32 }}>
              {tab === 'posts'
                ? 'No posts yet.'
                : tab === 'likes'
                  ? 'Notes you like will appear here.'
                  : 'Notes you repost will appear here.'}
            </Text>
          )
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}
