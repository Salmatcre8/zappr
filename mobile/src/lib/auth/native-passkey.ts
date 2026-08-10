/*
  Native passkey + PRF layer (issue #6 spike) via react-native-passkeys.

  Requires an EAS DEVELOPMENT BUILD — in Expo Go the native module is
  absent, so everything here is lazily required and gated behind
  passkeysAvailable(). RP ID must be the registrable domain (usezappr.xyz),
  same as web after #12, so a passkey enrolled on the website resolves in
  the app (Android needs /.well-known/assetlinks.json on that domain,
  iOS needs the AASA file + associated-domains entitlement).
*/
import { Buffer } from 'buffer';
import { LIQUID_SALT, NOSTR_SALT } from './derive';

export const RP_ID = process.env.EXPO_PUBLIC_RP_ID ?? 'usezappr.xyz';

export type PrfOutputs = {
  credentialId: string; // base64url
  nostrPrf: Uint8Array;
  liquidPrf: Uint8Array;
};

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/** Accepts whatever shape the native module hands back for PRF results. */
function toBytes(v: unknown): Uint8Array | null {
  if (!v) return null;
  if (typeof v === 'string') return fromB64url(v);
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (Array.isArray(v)) return Uint8Array.from(v as number[]);
  if (typeof v === 'object') {
    // Some bridges serialize byte arrays as {"0":110,"1":42,...}
    const vals = Object.values(v as Record<string, unknown>);
    if (vals.length > 0 && vals.every((x) => typeof x === 'number')) {
      return Uint8Array.from(vals as number[]);
    }
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/*
  Credential Manager ceremonies can hang indefinitely if a request gets
  dropped (notably a get() fired right after a create()). Never leave the
  UI spinning forever — fail with a retryable message instead.
*/
function ceremony<T>(p: Promise<T>, label: string, ms = 90_000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out — close any stuck sheet and try again`)),
        ms
      )
    ),
  ]);
}

type PasskeysModule = {
  isSupported: () => boolean;
  create: (opts: unknown) => Promise<unknown>;
  get: (opts: unknown) => Promise<unknown>;
};

let cached: PasskeysModule | null | undefined;

function mod(): PasskeysModule | null {
  if (cached !== undefined) return cached;
  try {
    // Lazy require: in Expo Go the native module throws on load.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-passkeys') as PasskeysModule;
  } catch {
    cached = null;
  }
  return cached;
}

export function passkeysAvailable(): boolean {
  const m = mod();
  try {
    return !!m && m.isSupported();
  } catch {
    return false;
  }
}

function randomB64url(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

const PRF_EXT = {
  prf: { eval: { first: b64url(NOSTR_SALT), second: b64url(LIQUID_SALT) } },
};

function readPrf(result: unknown): { first: Uint8Array | null; second: Uint8Array | null } {
  const r = result as {
    clientExtensionResults?: { prf?: { results?: { first?: unknown; second?: unknown } } };
  };
  const results = r?.clientExtensionResults?.prf?.results;
  return { first: toBytes(results?.first), second: toBytes(results?.second) };
}

/** Create a new passkey with PRF evaluated against both zappr salts. */
export async function createPasskeyNative(displayName: string): Promise<PrfOutputs> {
  const m = mod();
  if (!m) throw new Error('Passkeys need the development build — not available in Expo Go');

  const created = await ceremony(
    m.create({
      challenge: randomB64url(32),
      rp: { id: RP_ID, name: 'zappr' },
      user: { id: randomB64url(16), name: displayName, displayName },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        userVerification: 'required',
        residentKey: 'required',
      },
      extensions: PRF_EXT,
    }),
    'Passkey creation'
  );
  if (!created) throw new Error('Passkey creation cancelled');

  const rawId = (created as { rawId?: string; id?: string }).rawId ??
    (created as { id?: string }).id;
  if (!rawId) throw new Error('No credential id returned');

  let { first, second } = readPrf(created);
  // Some authenticators only evaluate PRF on get() — mirror web's fallback.
  // Breathe before the follow-up prompt: Android's Credential Manager
  // drops a get() fired immediately after a create(), which used to hang
  // this flow forever.
  if (!first || !second) {
    await sleep(600);
    const again = await assertPasskeyNative(rawId);
    first = again.nostrPrf;
    second = again.liquidPrf;
  }
  if (!first || !second) {
    throw new Error('PRF extension not supported by this authenticator');
  }
  return { credentialId: rawId, nostrPrf: first, liquidPrf: second };
}

/** Re-evaluate PRF against a known credential id. */
export async function assertPasskeyNative(credentialId: string): Promise<PrfOutputs> {
  const m = mod();
  if (!m) throw new Error('Passkeys need the development build — not available in Expo Go');

  const assertion = await ceremony(
    m.get({
      challenge: randomB64url(32),
      rpId: RP_ID,
      allowCredentials: [{ id: credentialId, type: 'public-key' }],
      userVerification: 'required',
      extensions: PRF_EXT,
    }),
    'Biometric assertion'
  );
  if (!assertion) throw new Error('Biometric assertion cancelled');

  const { first, second } = readPrf(assertion);
  if (!first || !second) {
    throw new Error('PRF unlock failed — authenticator did not return key material');
  }
  const rawId = (assertion as { rawId?: string; id?: string }).rawId ??
    (assertion as { id?: string }).id ?? credentialId;
  return { credentialId: rawId, nostrPrf: first, liquidPrf: second };
}

/**
 * Discover any zappr passkey on this device (empty allowCredentials) —
 * the cross-platform test: a passkey enrolled on the WEBSITE should appear
 * here and derive the SAME identity.
 */
export async function discoverPasskeyNative(): Promise<PrfOutputs> {
  const m = mod();
  if (!m) throw new Error('Passkeys need the development build — not available in Expo Go');

  const assertion = await ceremony(
    m.get({
      challenge: randomB64url(32),
      rpId: RP_ID,
      allowCredentials: [],
      userVerification: 'required',
      extensions: PRF_EXT,
    }),
    'Passkey selection'
  );
  if (!assertion) throw new Error('Biometric cancelled');

  const { first, second } = readPrf(assertion);
  if (!first || !second) {
    throw new Error('PRF unlock failed — authenticator did not return key material');
  }
  const rawId = (assertion as { rawId?: string; id?: string }).rawId ??
    (assertion as { id?: string }).id;
  if (!rawId) throw new Error('No credential id returned');
  return { credentialId: rawId, nostrPrf: first, liquidPrf: second };
}
