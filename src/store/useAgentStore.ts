import { create } from 'zustand';
import type { AgentMessage, PendingConfirmation } from '@/types/agent';

type AgentState = {
  messages: AgentMessage[];
  busy: boolean;
  status: string | null;
  pending: PendingConfirmation | null;
  queuedQuestion: string | null;
  addMessage: (m: AgentMessage) => void;
  setMessages: (m: AgentMessage[]) => void;
  setBusy: (v: boolean) => void;
  setStatus: (s: string | null) => void;
  setPending: (p: PendingConfirmation | null) => void;
  queueQuestion: (q: string) => void;
  clearQueuedQuestion: () => void;
  reset: () => void;
};

export const useAgentStore = create<AgentState>((set) => ({
  messages: [],
  busy: false,
  status: null,
  pending: null,
  queuedQuestion: null,
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setMessages: (m) => set({ messages: m }),
  setBusy: (v) => set({ busy: v }),
  setStatus: (s) => set({ status: s }),
  setPending: (p) => set({ pending: p }),
  queueQuestion: (q) => set({ queuedQuestion: q }),
  clearQueuedQuestion: () => set({ queuedQuestion: null }),
  reset: () => set({ messages: [], busy: false, status: null, pending: null, queuedQuestion: null }),
}));
