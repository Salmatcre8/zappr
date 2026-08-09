/*
  Runtime polyfills required by the Nostr stack (NDK, nostr-tools, @getalby/sdk)
  on React Native / Hermes. Must be imported FIRST, before anything that touches
  crypto or text encoding (see the root app/_layout.tsx).

  - react-native-get-random-values: crypto.getRandomValues for @noble/* key ops
  - fast-text-encoding: TextEncoder/TextDecoder (guarded — no-op if Hermes has them)
  - buffer: some transitive deps expect a global Buffer
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
