/*
  Note thread screen (issue #14): the note, its replies from the connected
  relays, a reply composer, and a like action. Replies and likes publish
  immediately (cheap, reversible socially if not technically); zaps keep the
  confirm-before-send flow on the feed row.
*/
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Image } from 'expo-image';

import Avatar from '@/components/Avatar';
import { splitMedia } from '@/lib/note-media';
import { mono, sans, sansBold, sansHeavy, sansSemiBold, useZapprTheme } from '@/lib/theme';
import { timeAgo } from '@/lib/relative-time';
import { initNDK } from '@/lib/nostr/ndk';
import {
  fetchMyEngagement,
  fetchNoteById,
  fetchProfiles,
  fetchReplies,
  publishReaction,
  publishReply,
  publishRepost,
} from '@/lib/nostr/events';
import { addMark, loadMarks } from '@/lib/nostr/engage-cache';
import { truncateNpub } from '@/lib/nostr/keys';
import { useNostrStore } from '@/store/useNostrStore';
import { toast } from '@/store/useToastStore';
import type { FeedNote, NostrProfile } from '@/types/nostr';

function ReplyRow({ reply, profile }: { reply: FeedNote; profile?: NostrProfile }) {
  const t = useZapprTheme();
  const name =
    profile?.displayName || profile?.name || truncateNpub(profile?.npub || reply.pubkey, 6);
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: t.lineSoft,
      }}
    >
      <Avatar pubkey={reply.pubkey} picture={profile?.picture} name={name} size={32} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7 }}>
          <Text numberOfLines={1} style={[sansSemiBold, { color: t.bone, fontSize: 13.5 }]}>
            {name}
          </Text>
          <Text style={{ color: t.faint, fontSize: 11.5 }}>· {timeAgo(reply.createdAt)}</Text>
        </View>
        <Text style={[sans, { color: t.text2, fontSize: 14, lineHeight: 21, marginTop: 3 }]}>
          {reply.content}
        </Text>
      </View>
    </View>
  );
}

export default function NoteThreadScreen() {
  const t = useZapprTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ndk, pubkey, feed, profiles, setNdk, upsertProfiles } = useNostrStore();

  const [note, setNote] = useState<FeedNote | null>(feed.find((n) => n.id === id) ?? null);
  const [replies, setReplies] = useState<FeedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [reposting, setReposting] = useState(false);

  // Like/Repost state must survive closing the thread: local cache answers
  // instantly, then the relays confirm (covers likes from other devices).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      const [likedCache, repostCache] = await Promise.all([
        loadMarks('liked'),
        loadMarks('reposted'),
      ]);
      if (cancelled) return;
      if (likedCache.has(id)) setLiked(true);
      if (repostCache.has(id)) setReposted(true);
      if (pubkey && ndk) {
        const mine = await fetchMyEngagement(ndk, pubkey, id).catch(() => null);
        if (cancelled || !mine) return;
        if (mine.liked) setLiked(true);
        if (mine.reposted) setReposted(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, pubkey, ndk]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        const instance = ndk ?? (await initNDK());
        if (!ndk) setNdk(instance);
        let current = note;
        if (!current) {
          current = await fetchNoteById(instance, id);
          if (cancelled) return;
          if (current) setNote(current);
        }
        const found = await fetchReplies(instance, id);
        if (cancelled) return;
        setReplies(found);
        const missing = Array.from(
          new Set([...(current ? [current.pubkey] : []), ...found.map((r) => r.pubkey)])
        ).filter((p) => !profiles[p]);
        if (missing.length) {
          const profs = await fetchProfiles(instance, missing);
          if (!cancelled && Object.keys(profs).length) upsertProfiles(profs);
        }
      } catch {
        if (!cancelled) toast('Relays are slow right now — go back and retry');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sendReply = async () => {
    if (!ndk || !pubkey || !note || !draft.trim() || sending) return;
    setSending(true);
    try {
      const newId = await publishReply(ndk, note, draft.trim());
      setReplies((r) => [
        ...r,
        { id: newId, pubkey, content: draft.trim(), createdAt: Math.floor(Date.now() / 1000), tags: [] },
      ]);
      setDraft('');
      toast('Reply published');
    } catch {
      toast('Reply failed to publish — try again');
    }
    setSending(false);
  };

  const like = async () => {
    if (!ndk || !pubkey || !note || liked || liking) return;
    setLiking(true);
    try {
      await publishReaction(ndk, note);
      setLiked(true);
      await addMark('liked', note.id);
      toast('❤️ Liked');
    } catch {
      toast('Reaction failed to publish — try again');
    }
    setLiking(false);
  };

  const repost = async () => {
    if (!ndk || !pubkey || !note || reposted || reposting) return;
    setReposting(true);
    try {
      await publishRepost(ndk, note);
      setReposted(true);
      await addMark('reposted', note.id);
      toast('🔁 Reposted to your followers');
    } catch {
      toast('Repost failed to publish — try again');
    }
    setReposting(false);
  };

  const noteProfile = note ? profiles[note.pubkey] : undefined;
  const noteName = note
    ? noteProfile?.displayName ||
      noteProfile?.name ||
      truncateNpub(noteProfile?.npub || note.pubkey, 6)
    : '';

  const header = note ? (
    <View style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', gap: 11 }}>
        <Avatar pubkey={note.pubkey} picture={noteProfile?.picture} name={noteName} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7 }}>
            <Text numberOfLines={1} style={[sansSemiBold, { color: t.bone, fontSize: 14.5 }]}>
              {noteName}
            </Text>
            <Text style={{ color: t.faint, fontSize: 12 }}>· {timeAgo(note.createdAt)}</Text>
          </View>
          {(() => {
            const { text, images } = splitMedia(note.content);
            return (
              <>
                {text ? (
                  <Text
                    style={[sans, { color: t.bone, fontSize: 15.5, lineHeight: 24, marginTop: 6 }]}
                  >
                    {text}
                  </Text>
                ) : null}
                {images.map((uri) => (
                  <Image
                    key={uri}
                    source={{ uri }}
                    style={{
                      width: '100%',
                      height: 220,
                      borderRadius: 12,
                      marginTop: 8,
                      backgroundColor: t.surface,
                    }}
                    contentFit="cover"
                    transition={150}
                  />
                ))}
              </>
            );
          })()}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <Pressable
          onPress={like}
          disabled={!pubkey || liked || liking}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: liked ? 'transparent' : t.line,
            backgroundColor: liked ? t.orange : 'transparent',
            opacity: pubkey ? 1 : 0.5,
          }}
        >
          {liking ? (
            <ActivityIndicator size="small" color={t.dim} />
          ) : (
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={14}
              color={liked ? t.onOrange : t.dim}
            />
          )}
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: liked ? '700' : '600',
              color: liked ? t.onOrange : t.dim,
            }}
          >
            {liked ? 'Liked' : 'Like'}
          </Text>
        </Pressable>
        <Pressable
          onPress={repost}
          disabled={!pubkey || reposted || reposting}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: reposted ? 'transparent' : t.line,
            backgroundColor: reposted ? t.orange : 'transparent',
            opacity: pubkey ? 1 : 0.5,
          }}
        >
          {reposting ? (
            <ActivityIndicator size="small" color={t.dim} />
          ) : (
            <Ionicons
              name="repeat-outline"
              size={15}
              color={reposted ? t.onOrange : t.dim}
            />
          )}
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: reposted ? '700' : '600',
              color: reposted ? t.onOrange : t.dim,
            }}
          >
            {reposted ? 'Reposted' : 'Repost'}
          </Text>
        </Pressable>
        {replies.length > 0 ? (
          <Text style={[mono, { color: t.faint, fontSize: 10.5 }]}>
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'} on your relays
          </Text>
        ) : null}
      </View>
    </View>
  ) : null;

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
            paddingBottom: 12,
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
            Thread
          </Text>
        </View>

        {loading && !note ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <ActivityIndicator color={t.orange} />
            <Text style={{ color: t.faint, fontSize: 12 }}>loading thread…</Text>
          </View>
        ) : !note ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.faint, fontSize: 12.5 }}>
              Couldn’t find this note on your relays.
            </Text>
          </View>
        ) : (
          <FlatList
            data={replies}
            keyExtractor={(r) => r.id}
            ListHeaderComponent={header}
            renderItem={({ item }) => <ReplyRow reply={item} profile={profiles[item.pubkey]} />}
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator color={t.orange} style={{ marginTop: 24 }} />
              ) : (
                <Text
                  style={{ color: t.faint, fontSize: 12, textAlign: 'center', marginTop: 32 }}
                >
                  No replies yet — start the conversation.
                </Text>
              )
            }
            contentContainerStyle={{ paddingBottom: 12 }}
          />
        )}

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: t.lineSoft,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          {pubkey ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a reply…"
                placeholderTextColor={t.faint}
                multiline
                style={{
                  flex: 1,
                  maxHeight: 110,
                  backgroundColor: t.surface,
                  color: t.bone,
                  borderWidth: 1,
                  borderColor: t.line,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontSize: 14.5,
                }}
              />
              <Pressable
                onPress={sendReply}
                disabled={sending || !draft.trim()}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: t.orange,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: sending || !draft.trim() ? 0.5 : 1,
                }}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={t.onOrange} />
                ) : (
                  <Ionicons name="arrow-up" size={18} color={t.onOrange} />
                )}
              </Pressable>
            </View>
          ) : (
            <Text style={[sansBold, { color: t.faint, fontSize: 12, textAlign: 'center' }]}>
              Log in to reply and like.
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
