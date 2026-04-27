/*
  sessionStorage layer for zappr.

  Stores a minimal hint about how the user logged in — either a raw nsec
  (for direct nsec login) or a `useNip07` flag (for browser-extension login).
  This lets a page refresh restore the session without re-prompting.

  This layer is TEMPORARY for nsec logins. The moment the user enrolls a
  biometric vault (IndexedDB + WebAuthn PRF), this entry is wiped and the
  vault becomes the source of truth. We never want both running at once.
*/

const SESSION_KEY = 'zappr:session';

export type StoredSession = {
  nsec?: string;
  useNip07?: boolean;
  nwc?: string | null;
};

export function saveSession(s: StoredSession): void {
  if (typeof window === 'undefined') return;
  if (!s.nsec && !s.useNip07) return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {}
}

export function loadSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.nsec && !parsed.useNip07) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}
