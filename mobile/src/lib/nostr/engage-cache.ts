/*
  Local record of the viewer's own likes/reposts so thread screens show the
  right state instantly (and even when relays are slow to echo our events).
  Relays stay the source of truth — this is a smoothing layer, capped small.
*/
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = { liked: 'zappr:liked', reposted: 'zappr:reposted' } as const;
const CAP = 500;

export type EngageKind = keyof typeof KEYS;

export async function loadMarks(kind: EngageKind): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEYS[kind]);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function addMark(kind: EngageKind, noteId: string): Promise<void> {
  try {
    const marks = Array.from(await loadMarks(kind));
    if (marks.includes(noteId)) return;
    marks.push(noteId);
    await AsyncStorage.setItem(KEYS[kind], JSON.stringify(marks.slice(-CAP)));
  } catch {}
}
