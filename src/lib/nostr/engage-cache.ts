/*
  Local record of the viewer's own likes/reposts so thread views show the
  right state instantly (and even when relays are slow to echo our events).
  Relays stay the source of truth — this is a smoothing layer, capped small.
*/
const KEYS = { liked: 'zappr:liked', reposted: 'zappr:reposted' } as const;
const CAP = 500;

export type EngageKind = keyof typeof KEYS;

export function loadMarks(kind: EngageKind): Set<string> {
  try {
    const raw = localStorage.getItem(KEYS[kind]);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function addMark(kind: EngageKind, noteId: string): void {
  try {
    const marks = Array.from(loadMarks(kind));
    if (marks.includes(noteId)) return;
    marks.push(noteId);
    localStorage.setItem(KEYS[kind], JSON.stringify(marks.slice(-CAP)));
  } catch {}
}
