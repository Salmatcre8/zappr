import { create } from 'zustand';

/*
  Transient feedback per the mockup's toast: dark pill above the tab bar,
  auto-dismissed. Screens call toast('...') for anything that doesn't need
  to persist; lasting errors stay inline next to their control.
*/
type ToastState = {
  message: string | null;
  show: (message: string) => void;
  clear: () => void;
};

let timer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (message) => {
    if (timer) clearTimeout(timer);
    set({ message });
    timer = setTimeout(() => set({ message: null }), 2200);
  },
  clear: () => {
    if (timer) clearTimeout(timer);
    set({ message: null });
  },
}));

export const toast = (message: string) => useToastStore.getState().show(message);
