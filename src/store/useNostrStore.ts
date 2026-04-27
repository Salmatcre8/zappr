import { create } from 'zustand';
import type NDK from '@nostr-dev-kit/ndk';
import type { FeedNote, NostrProfile } from '@/types/nostr';

type NostrState = {
  ndk: NDK | null;
  pubkey: string | null;
  npub: string | null;
  profile: NostrProfile | null;
  follows: string[];
  feed: FeedNote[];
  profiles: Record<string, NostrProfile>;
  loadingFeed: boolean;
  setNdk: (ndk: NDK) => void;
  setIdentity: (pubkey: string, npub: string, profile?: NostrProfile | null) => void;
  setFollows: (follows: string[]) => void;
  setFeed: (feed: FeedNote[]) => void;
  upsertProfile: (p: NostrProfile) => void;
  setLoadingFeed: (v: boolean) => void;
  reset: () => void;
};

export const useNostrStore = create<NostrState>((set) => ({
  ndk: null,
  pubkey: null,
  npub: null,
  profile: null,
  follows: [],
  feed: [],
  profiles: {},
  loadingFeed: false,
  setNdk: (ndk) => set({ ndk }),
  setIdentity: (pubkey, npub, profile) => set({ pubkey, npub, profile: profile || null }),
  setFollows: (follows) => set({ follows }),
  setFeed: (feed) => set({ feed }),
  upsertProfile: (p) =>
    set((s) => ({ profiles: { ...s.profiles, [p.pubkey]: p } })),
  setLoadingFeed: (v) => set({ loadingFeed: v }),
  reset: () =>
    set({ ndk: null, pubkey: null, npub: null, profile: null, follows: [], feed: [], profiles: {} }),
}));
