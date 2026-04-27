import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ink = ALWAYS near-black. Use for text on orange/volt accents.
        ink: '#0A0A0A',
        // bone = primary text color (flips with theme)
        bone: 'rgb(var(--bone) / <alpha-value>)',
        // panel = raised panel surface (flips)
        panel: 'rgb(var(--panel) / <alpha-value>)',
        // surface = recessed card/inset surface inside panels (flips)
        surface: 'rgb(var(--surface) / <alpha-value>)',
        // bg = the app page background (flips)
        bg: 'rgb(var(--bg) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        orange: { DEFAULT: '#F7931A', 500: '#F7931A', 600: '#D97C06' },
        volt: '#FFE500',
      },
      fontFamily: {
        mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        brut: '4px 4px 0px 0px #000000',
        'brut-sm': '2px 2px 0px 0px #000000',
        'brut-orange': '4px 4px 0px 0px #F7931A',
        'brut-volt': '4px 4px 0px 0px #FFE500',
      },
      borderRadius: { none: '0', sm: '2px' },
      transitionDuration: { DEFAULT: '120ms' },
    },
  },
  plugins: [],
};
export default config;
