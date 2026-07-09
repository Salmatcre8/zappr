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
        // secondary / caption text (flips with theme)
        dim: 'rgb(var(--dim) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        // orange = accent, theme-aware (#F7931A dark / #DD7B08 light)
        orange: 'rgb(var(--orange) / <alpha-value>)',
        volt: '#FFE500',
      },
      fontFamily: {
        mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        // soft, elevation-based shadows (revamp) — replaces hard offset shadows
        brut: '0 4px 14px rgba(20, 15, 5, 0.06)',
        'brut-sm': '0 2px 8px rgba(20, 15, 5, 0.05)',
        'brut-lg': '0 20px 50px rgba(20, 15, 5, 0.12)',
        'brut-orange': '0 8px 22px rgb(var(--orange) / 0.28)',
      },
      borderRadius: { none: '0', sm: '7px', md: '10px', lg: '14px', xl: '18px' },
      transitionDuration: { DEFAULT: '140ms' },
    },
  },
  plugins: [],
};
export default config;
