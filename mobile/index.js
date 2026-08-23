/*
  Custom entry: polyfills MUST evaluate before expo-router loads any route
  module (see src/lib/polyfills.ts for why). Referenced by package.json#main.
*/
import './src/lib/polyfills';
import 'expo-router/entry';
