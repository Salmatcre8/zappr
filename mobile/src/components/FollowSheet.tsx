import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import Avatar from './Avatar';
import BottomSheet from './BottomSheet';
import { mono, sansSemiBold, sectionLabel, useZapprTheme } from '@/lib/theme';
import { publishContacts } from '@/lib/nostr/events';
import { saveFollows } from '@/lib/nostr/follow-cache';
import { npubToHex, truncateNpub } from '@/lib/nostr/keys';
import { useNostrStore } from '@/store/useNostrStore';
import { toast } from '@/store/useToastStore';
import type { NostrProfile } from '@/types/nostr';
import type { NDKFilter, NDKKind } from '@nostr-dev-kit/ndk';

/*
  "Follow someone" — web FollowCard parity (web src/components/feed/FollowCard.tsx):
  paste an npub / hex pubkey, or tap a curated suggestion. Plus a mobile
  extra: name search over kind:0 profiles (NIP-50, served by nostr.band).
*/

// Same well-known npubs the web seeds empty accounts with.
const SUGGESTED: { label: string; npub: string }[] = [
  { label: 'fiatjaf (creator of Nostr)', npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6' },
  { label: 'jack', npub: 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m' },
  { label: 'jb55 (Damus)', npub: 'npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s' },
  { label: 'odell (Bitcoin podcaster)', npub: 'npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx' },
  { label: 'PABLOF7z (NDK author)', npub: 'npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft' },
];

export default function FollowSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const t = useZapprTheme();
  const { ndk, pubkey, follows, setFollows } = useNostrStore();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<NostrProfile[] | null>(null);

  const followHex = async (hex: string, name?: string) => {
    if (!ndk || !pubkey) return;
    if (follows.includes(hex)) {
      toast('Already following');
      return;
    }
    setBusy(true);
    try {
      const next = Array.from(new Set([...follows, hex]));
      setFollows(next); // optimistic — local cache is the source of truth
      await saveFollows(pubkey, next);
      const { createdAt } = await publishContacts(ndk, next);
      await saveFollows(pubkey, next, createdAt);
      toast(`Following ${name || truncateNpub(hex, 6)}`);
    } catch {
      toast('Saved locally — will publish when relays respond');
    }
    setBusy(false);
  };

  /*
    One box, two behaviors: an npub/hex follows directly (web behavior);
    anything else searches kind:0 profiles by name via NIP-50.
  */
  const submit = async () => {
    const q = input.trim();
    if (!q) return;
    if (q.startsWith('npub1')) {
      try {
        await followHex(npubToHex(q));
        setInput('');
      } catch {
        toast('That npub does not look valid');
      }
      return;
    }
    if (/^[0-9a-f]{64}$/i.test(q)) {
      await followHex(q.toLowerCase());
      setInput('');
      return;
    }
    if (!ndk) return;
    setSearching(true);
    setResults(null);
    try {
      const filter = { kinds: [0 as NDKKind], search: q, limit: 12 } as NDKFilter;
      const events = await ndk.fetchEvents(filter);
      const found: NostrProfile[] = [];
      const seen = new Set<string>();
      for (const ev of events) {
        if (seen.has(ev.pubkey)) continue;
        seen.add(ev.pubkey);
        try {
          const meta = JSON.parse(ev.content) as Record<string, string | undefined>;
          found.push({
            npub: '',
            pubkey: ev.pubkey,
            name: meta.name,
            displayName: meta.display_name || meta.displayName,
            picture: meta.picture,
            nip05: meta.nip05,
          });
        } catch {}
      }
      setResults(found.slice(0, 10));
      if (found.length === 0) toast('No profiles matched — try an npub');
    } catch {
      toast('Search failed — relays may not support it; paste an npub instead');
    }
    setSearching(false);
  };

  const chip = (label: string, followed: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      disabled={busy || followed}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: followed ? 'transparent' : t.line,
        backgroundColor: followed ? t.orange : t.panel,
        opacity: busy ? 0.6 : 1,
      }}
    >
      <Text
        style={[
          mono,
          { fontSize: 11, color: followed ? t.onOrange : t.dim },
        ]}
      >
        {followed ? '✓ ' : '+ '}
        {label}
      </Text>
    </Pressable>
  );

  return (
    <BottomSheet visible={visible} title="Follow someone" onClose={onClose}>
      {!pubkey ? (
        <Text style={{ color: t.dim, fontSize: 13.5, lineHeight: 20 }}>
          Log in first — following publishes a signed contact list from your identity.
        </Text>
      ) : (
        <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="npub1… or search a name"
              placeholderTextColor={t.faint}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={submit}
              returnKeyType="search"
              style={{
                flex: 1,
                backgroundColor: t.surface,
                color: t.bone,
                borderWidth: 1,
                borderColor: t.line,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14,
              }}
            />
            <Pressable
              onPress={submit}
              disabled={busy || searching || !input.trim()}
              style={{
                backgroundColor: t.orange,
                borderRadius: 12,
                paddingHorizontal: 14,
                justifyContent: 'center',
                opacity: busy || searching || !input.trim() ? 0.5 : 1,
              }}
            >
              {searching ? (
                <ActivityIndicator color={t.onOrange} />
              ) : (
                <Ionicons name="search" size={16} color={t.onOrange} />
              )}
            </Pressable>
          </View>

          {results && results.length > 0 ? (
            <View style={{ gap: 8, marginTop: 14 }}>
              <Text style={sectionLabel(t)}>Results</Text>
              {results.map((p) => {
                const followed = follows.includes(p.pubkey);
                const name = p.displayName || p.name || truncateNpub(p.pubkey, 6);
                return (
                  <View
                    key={p.pubkey}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    <Avatar pubkey={p.pubkey} picture={p.picture} name={name} size={34} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={[sansSemiBold, { color: t.bone, fontSize: 13.5 }]}
                      >
                        {name}
                      </Text>
                      {p.nip05 ? (
                        <Text numberOfLines={1} style={[mono, { color: t.faint, fontSize: 10 }]}>
                          {p.nip05}
                        </Text>
                      ) : null}
                    </View>
                    {chip(followed ? 'Following' : 'Follow', followed, () =>
                      followHex(p.pubkey, name)
                    )}
                  </View>
                );
              })}
            </View>
          ) : null}

          <Text style={[sectionLabel(t), { marginTop: 16, marginBottom: 8 }]}>
            Suggested follows
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTED.map((s) => {
              let hex = '';
              try {
                hex = npubToHex(s.npub);
              } catch {}
              const followed = !!hex && follows.includes(hex);
              return chip(s.label, followed, () => hex && followHex(hex, s.label));
            })}
          </View>
        </ScrollView>
      )}
    </BottomSheet>
  );
}
