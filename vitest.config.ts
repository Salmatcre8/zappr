import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    // The suite covers pure key-derivation, parsing and crypto logic — no DOM,
    // no native modules — so the plain node environment is both correct and fast.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
