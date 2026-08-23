/*
  Runtime polyfills required by the Nostr stack (NDK, nostr-tools, @getalby/sdk)
  on React Native / Hermes.

  ORDERING MATTERS: this module is imported by the custom app entry (index.js)
  BEFORE expo-router loads any route. @noble/hashes captures globalThis.crypto
  at module-eval time, so installing getRandomValues from inside a route layout
  is too late — the capture would already have happened as `undefined`.

  - react-native-get-random-values: crypto.getRandomValues for @noble/* key ops
  - fast-text-encoding: TextEncoder/TextDecoder (guarded — no-op if present)
  - buffer: some transitive deps expect a global Buffer
  - MessageChannel: Hermes doesn't ship it; nostr-tools' relay queue
    (yieldThread) does `new MessageChannel()` to yield between events.
*/
import 'react-native-get-random-values';
import 'fast-text-encoding';
import { Buffer } from 'buffer';

declare global {
  // eslint-disable-next-line no-var
  var Buffer: typeof import('buffer').Buffer;
}

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}

/*
  Minimal MessageChannel: enough for the postMessage → onmessage round-trip
  nostr-tools uses to yield the JS thread. Delivery is async via setTimeout,
  matching the "not synchronous" guarantee the real API provides.
*/
if (typeof (globalThis as Record<string, unknown>).MessageChannel === 'undefined') {
  type Listener = (ev: { data: unknown }) => void;

  class MessagePortPolyfill {
    onmessage: Listener | null = null;
    otherPort: MessagePortPolyfill | null = null;
    private listeners: Listener[] = [];

    postMessage(data: unknown): void {
      const target = this.otherPort;
      if (!target) return;
      setTimeout(() => {
        const ev = { data };
        target.onmessage?.(ev);
        for (const l of target.listeners) l(ev);
      }, 0);
    }

    addEventListener(type: string, listener: Listener): void {
      if (type === 'message') this.listeners.push(listener);
    }

    removeEventListener(type: string, listener: Listener): void {
      if (type === 'message') this.listeners = this.listeners.filter((l) => l !== listener);
    }

    start(): void {}
    close(): void {
      this.onmessage = null;
      this.listeners = [];
    }
  }

  class MessageChannelPolyfill {
    port1 = new MessagePortPolyfill();
    port2 = new MessagePortPolyfill();
    constructor() {
      this.port1.otherPort = this.port2;
      this.port2.otherPort = this.port1;
    }
  }

  (globalThis as Record<string, unknown>).MessageChannel = MessageChannelPolyfill;
}
