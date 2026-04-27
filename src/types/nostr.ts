export type NostrProfile = {
  npub: string;
  pubkey: string;
  name?: string;
  displayName?: string;
  picture?: string;
  nip05?: string;
  lud16?: string;
  about?: string;
};

export type FeedNote = {
  id: string;
  pubkey: string;
  content: string;
  createdAt: number;
  author?: NostrProfile;
  tags: string[][];
};
