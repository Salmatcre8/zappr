import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import { mono, sans, sansSemiBold, useZapprTheme } from '@/lib/theme';
import { timeAgo } from '@/lib/relative-time';
import { truncateNpub } from '@/lib/nostr/keys';
import type { NoteEngagement } from '@/lib/nostr/events';
import type { FeedNote, NostrProfile } from '@/types/nostr';

/*
  Feed row per the mobile mockup: flat list item over a soft hairline (no
  card chrome), hue avatar, name · time, body in text2, hashtags in orange
  mono, and a pill zap button that flips to orange once zapped.

  Engagement counts (issue #13) render as small tonal indicators — they're
  relay-local approximations, so they stay quiet by design.

  Memoized: FlatList re-renders every visible row on each state change
  (profile hydration batches, zap state) unless props are referentially
  stable — keep the props primitive or store-stable.
*/

function Indicator({
  icon,
  count,
  label,
  color,
  dimColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  label?: string;
  color: string;
  dimColor: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name={icon} size={12} color={count > 0 ? color : dimColor} />
      {count > 0 ? (
        <Text style={[mono, { fontSize: 10.5, color }]}>{label ?? count}</Text>
      ) : null}
    </View>
  );
}

function NoteRow({
  note,
  profile,
  engagement,
  zapped,
  zapAmount,
  onZap,
  onOpen,
}: {
  note: FeedNote;
  profile?: NostrProfile;
  engagement?: NoteEngagement;
  zapped?: boolean;
  zapAmount: number;
  /** undefined = zap unavailable (no wallet / author has no lud16). */
  onZap?: (note: FeedNote, profile: NostrProfile) => void;
  /** Tap anywhere on the row to open the thread view (issue #14). */
  onOpen?: (note: FeedNote) => void;
}) {
  const t = useZapprTheme();
  const name =
    profile?.displayName || profile?.name || truncateNpub(profile?.npub || note.pubkey, 6);
  const zappable = !!onZap && !!profile?.lud16;
  const hashtags = note.tags
    .filter((tag) => tag[0] === 't' && typeof tag[1] === 'string')
    .slice(0, 2)
    .map((tag) => `#${tag[1]}`);

  return (
    <Pressable
      onPress={onOpen ? () => onOpen(note) : undefined}
      style={{
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: t.lineSoft,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 11 }}>
        <Avatar pubkey={note.pubkey} picture={profile?.picture} name={name} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
            <Text numberOfLines={1} style={[sansSemiBold, { color: t.bone, fontSize: 14.5 }]}>
              {name}
            </Text>
            <Text style={{ color: t.faint, fontSize: 12 }}>· {timeAgo(note.createdAt)}</Text>
          </View>
          <Text style={[sans, { color: t.text2, fontSize: 14.5, lineHeight: 22, marginTop: 5 }]}>
            {note.content}
          </Text>
          {hashtags.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {hashtags.map((h) => (
                <Text key={h} style={[mono, { color: t.orange, fontSize: 11.5 }]}>
                  {h}
                </Text>
              ))}
            </View>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 11,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1 }}>
              <Indicator
                icon="chatbubble-outline"
                count={engagement?.replies ?? 0}
                color={t.dim}
                dimColor={t.lineSoft}
              />
              <Indicator
                icon="repeat-outline"
                count={engagement?.reposts ?? 0}
                color={t.dim}
                dimColor={t.lineSoft}
              />
              <Indicator
                icon="heart-outline"
                count={engagement?.reactions ?? 0}
                color={t.dim}
                dimColor={t.lineSoft}
              />
              <Indicator
                icon="flash-outline"
                count={engagement?.zaps ?? 0}
                label={
                  engagement && engagement.zapSats > 0
                    ? engagement.zapSats.toLocaleString()
                    : undefined
                }
                color={t.dim}
                dimColor={t.lineSoft}
              />
            </View>
            <Pressable
              onPress={() => (zappable && profile ? onZap(note, profile) : undefined)}
              disabled={!zappable || zapped}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: zapped ? 'transparent' : t.line,
                backgroundColor: zapped ? t.orange : 'transparent',
                opacity: zappable || zapped ? 1 : 0.5,
              }}
            >
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: zapped ? '700' : '600',
                  color: zapped ? t.onOrange : t.dim,
                }}
              >
                {zapped ? `⚡ ${zapAmount}` : '⚡ Zap'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default memo(NoteRow);
