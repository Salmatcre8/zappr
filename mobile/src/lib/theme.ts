/*
  zappr design tokens — mirrored from the Claude mobile design reference
  (Zappr Mobile Standalone) so the app matches the approved mockup exactly.
  Dark and warm-bone light, resolved from the OS color scheme.
*/
import { useColorScheme } from 'react-native';

export type ZapprPalette = {
  bg: string;
  panel: string;
  /** recessed surface inside a panel (mockup: --panel2) */
  surface: string;
  /** primary text (mockup: --text) */
  bone: string;
  /** body/content text, one step softer (mockup: --text2) */
  text2: string;
  dim: string;
  faint: string;
  line: string;
  /** hairline dividers inside lists (mockup: --lineSoft) */
  lineSoft: string;
  orange: string;
  /** translucent orange fill for user bubbles / confirm cards */
  orangeSoft: string;
  /** text/icons on orange fills — the mockup uses white */
  onOrange: string;
  /** incoming-payment green (text) + its soft fill */
  green: string;
  greenSoft: string;
  /** "LIVE" pulse dot green */
  live: string;
};

export const palettes: { dark: ZapprPalette; light: ZapprPalette } = {
  dark: {
    bg: '#0c0c0e',
    panel: '#151517',
    surface: '#1b1b1f',
    bone: '#ededf0',
    text2: '#c7c7cf',
    dim: '#9a9aa4',
    faint: '#66666f',
    line: '#2a2a30',
    lineSoft: '#202024',
    orange: '#F7931A',
    orangeSoft: 'rgba(247,147,26,.15)',
    onOrange: '#ffffff',
    green: '#26a35c',
    greenSoft: 'rgba(46,194,106,.14)',
    live: '#2ec26a',
  },
  light: {
    bg: '#F1EFE7',
    panel: '#FFFFFF',
    surface: '#F6F3EB',
    bone: '#1b1a17',
    text2: '#3a3934',
    dim: '#6d6b62',
    faint: '#a29f93',
    line: '#E4E1D6',
    lineSoft: '#EFEDE4',
    orange: '#DD7B08',
    orangeSoft: 'rgba(221,123,8,.12)',
    onOrange: '#ffffff',
    green: '#26a35c',
    greenSoft: 'rgba(46,194,106,.14)',
    live: '#2ec26a',
  },
};

export function useZapprTheme(): ZapprPalette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palettes.dark : palettes.light;
}

/*
  Brand fonts — the same pair as web (globals.css): Space Mono for the
  wordmark/labels/numbers, Inter for body and buttons. Loaded in the root
  layout via @expo-google-fonts; these families must match those imports.
*/
export const mono = { fontFamily: 'SpaceMono_400Regular' } as const;
export const monoBold = { fontFamily: 'SpaceMono_700Bold' } as const;
export const sans = { fontFamily: 'Inter_400Regular' } as const;
export const sansMedium = { fontFamily: 'Inter_500Medium' } as const;
export const sansSemiBold = { fontFamily: 'Inter_600SemiBold' } as const;
export const sansBold = { fontFamily: 'Inter_700Bold' } as const;
export const sansHeavy = { fontFamily: 'Inter_800ExtraBold' } as const;

/** mockup section label: Space Mono 10.5px letter-spaced uppercase */
export const sectionLabel = (t: ZapprPalette) =>
  ({
    ...mono,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: t.faint,
    textTransform: 'uppercase' as const,
  }) as const;
