import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import NoteRow from '@/components/NoteRow';
import ConfirmSheet from '@/components/ConfirmSheet';
import FollowSheet from '@/components/FollowSheet';
import { sansHeavy, useZapprTheme } from '@/lib/theme';
import { initNDK } from '@/lib/nostr/ndk';
import {
  fetchFeed,
  fetchFollowList,
  fetchGlobalFeed,
  fetchProfiles,
  publishContacts,
} from '@/lib/nostr/events';
import { loadFollows, saveFollows } from '@/lib/nostr/follow-cache';
import { truncateNpub } from '@/lib/nostr/keys';
import { lnAddressToInvoice } from '@/lib/wallet/lightning';
import { useNostrStore } from '@/store/useNostrStore';
import { useWalletStore } from '@/store/useWalletStore';
import { toast } from '@/store/useToastStore';
import type { FeedNote, NostrProfile } from '@/types/nostr';

const DEFAULT_ZAP_SATS = 21;

export default function FeedScreen() {
  const t = useZapprTheme();
  const {
    ndk, pubkey, follows, feed, profiles,
    setNdk, setFollows, setFeed, upsertProfiles,
  } = useNostrStore();
  const walletAdapter = useWalletStore((s) => s.adapter);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [zapTarget, setZapTarget] = useState<{ note: FeedNote; profile: NostrProfile } | null>(null);
  const [zapBusy, setZapBusy] = useState(false);
  const [zapped, setZapped] = useState<Record<string, boolean>>({});
  const [followSheet, setFollowSheet] = useState(false);
  const endReachedGate = useRef(false);

  const ensureNdk = useCallback(async () => {
    if (ndk) return ndk;
    const fresh = await initNDK();
    setNdk(fresh);
    return fresh;
  }, [ndk, setNdk]);

  const hydrateProfiles = useCallback(
    async (instance: NonNullable<typeof ndk>, notes: FeedNote[]) => {
      const missing = Array.from(new Set(notes.map((n) => n.pubkey))).filter((p) => !profiles[p]);
      if (missing.length === 0) return;
      const found = await fetchProfiles(instance, missing);
      if (Object.keys(found).length) upsertProfiles(found);
    },
    [profiles, upsertProfiles]
  );

  const loadFeed = useCallback(
    async (mode: 'reset' | 'more') => {
      const instance = await ensureNdk();
      const until =
        mode === 'more' && feed.length > 0 ? feed[feed.length - 1].createdAt - 1 : undefined;
      const notes =
        pubkey && follows.length > 0
          ? await fetchFeed(instance, follows, 40, until)
          : await fetchGlobalFeed(instance, 50, until);
      const merged = mode === 'reset' ? notes : dedupe([...feed, ...notes]);
      setFeed(merged);
      await hydrateProfiles(instance, notes);
    },
    [ensureNdk, feed, follows, pubkey, setFeed, hydrateProfiles]
  );

  // Initial load + reload when identity/follow set changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadFeed('reset');
      } catch {
        if (!cancelled) toast('Relays are slow right now — pull to retry');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey, follows.length]);

  // Local-first follows: cache immediately, reconcile against relays.
  useEffect(() => {
    if (!pubkey) return;
    let cancelled = false;
    (async () => {
      const cached = await loadFollows(pubkey);
      if (cached && !cancelled) setFollows(cached.follows);
      const instance = await ensureNdk();
      const remote = await fetchFollowList(instance, pubkey).catch(() => null);
      if (
        remote &&
        !cancelled &&
        (!cached || remote.createdAt > (cached.eventCreatedAt || 0))
      ) {
        setFollows(remote.follows);
        await saveFollows(pubkey, remote.follows, remote.createdAt);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadFeed('reset');
    } catch {
      toast('Relays are slow right now — pull to retry');
    }
    setRefreshing(false);
  };

  const onEndReached = async () => {
    if (endReachedGate.current || loading || refreshing || feed.length === 0) return;
    endReachedGate.current = true;
    setLoadingMore(true);
    try {
      await loadFeed('more');
    } catch {}
    setLoadingMore(false);
    endReachedGate.current = false;
  };

  const follow = async (target: string) => {
    if (!pubkey || !ndk) return;
    if (follows.includes(target)) return;
    const next = [...follows, target];
    setFollows(next); // optimistic — local cache is the source of truth
    await saveFollows(pubkey, next);
    const p = profiles[target];
    toast(`Following ${p?.displayName || p?.name || truncateNpub(p?.npub || target, 6)}`);
    try {
      const res = await publishContacts(ndk, next);
      await saveFollows(pubkey, next, res.createdAt);
    } catch {
      toast('Saved locally — will publish when relays respond');
    }
  };

  const onZapPress = useCallback(
    (note: FeedNote, profile: NostrProfile) => setZapTarget({ note, profile }),
    []
  );

  const approveZap = async () => {
    if (!zapTarget || !walletAdapter) return;
    setZapBusy(true);
    try {
      const lud16 = zapTarget.profile.lud16!;
      const bolt11 = await lnAddressToInvoice(lud16, DEFAULT_ZAP_SATS, 'zap via zappr');
      await walletAdapter.payInvoice(bolt11);
      setZapped((z) => ({ ...z, [zapTarget.note.id]: true }));
      toast(`⚡ Zapped ${DEFAULT_ZAP_SATS} sats`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Zap failed');
    }
    setZapBusy(false);
    setZapTarget(null);
  };

  /*
    Follow suggestions (mockup's pill row): authors present in the current
    feed that the user doesn't follow yet. Only meaningful when logged in.
  */
  const suggestions = pubkey
    ? Array.from(new Set(feed.map((n) => n.pubkey)))
        .filter((p) => p !== pubkey && !follows.includes(p))
        .slice(0, 6)
    : [];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.orange }} />
          <Text style={[sansHeavy, { color: t.bone, fontSize: 22, letterSpacing: -0.4 }]}>
            Feed
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() =>
              pubkey ? setFollowSheet(true) : toast('Log in from the login screen to follow people')
            }
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
            <Ionicons name="person-add-outline" size={15} color={t.orange} />
          </Pressable>
          <Pressable
            onPress={onRefresh}
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
            <Ionicons name="refresh" size={15} color={t.dim} />
          </Pressable>
        </View>
      </View>

      {suggestions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 14, gap: 8 }}
        >
          {suggestions.map((p) => {
            const prof = profiles[p];
            const name = prof?.displayName || prof?.name || truncateNpub(prof?.npub || p, 4);
            return (
              <Pressable
                key={p}
                onPress={() => follow(p)}
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: t.line,
                  backgroundColor: t.panel,
                }}
              >
                <Text style={{ color: t.dim, fontSize: 12.5, fontWeight: '500' }}>+ {name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {!pubkey ? (
        <Text style={{ color: t.faint, fontSize: 12, paddingHorizontal: 18, paddingBottom: 10 }}>
          Global notes — log in from Settings to see your follows.
        </Text>
      ) : null}

      {loading && feed.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <ActivityIndicator color={t.orange} />
          <Text style={{ color: t.faint, fontSize: 12 }}>connecting to relays…</Text>
        </View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => (
            <NoteRow
              note={item}
              profile={profiles[item.pubkey]}
              zapped={!!zapped[item.id]}
              zapAmount={DEFAULT_ZAP_SATS}
              onZap={walletAdapter ? onZapPress : undefined}
            />
          )}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.orange} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={t.orange} style={{ marginVertical: 12 }} /> : null
          }
          ListEmptyComponent={
            <Text
              style={{ color: t.faint, fontSize: 12, textAlign: 'center', marginTop: 40 }}
            >
              Nothing yet — pull to refresh.
            </Text>
          }
        />
      )}

      <FollowSheet visible={followSheet} onClose={() => setFollowSheet(false)} />

      <ConfirmSheet
        visible={!!zapTarget}
        title={`Zap ${DEFAULT_ZAP_SATS} sats`}
        rows={
          zapTarget
            ? [
                {
                  label: 'To',
                  value:
                    zapTarget.profile.displayName ||
                    zapTarget.profile.name ||
                    zapTarget.profile.lud16 ||
                    '—',
                },
                { label: 'Amount', value: `${DEFAULT_ZAP_SATS} sats`, accent: true },
              ]
            : []
        }
        busy={zapBusy}
        onApprove={approveZap}
        onCancel={() => setZapTarget(null)}
      />
    </SafeAreaView>
  );
}

function dedupe(notes: FeedNote[]): FeedNote[] {
  const seen = new Set<string>();
  const out: FeedNote[] = [];
  for (const n of notes) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
  }
  return out;
}
