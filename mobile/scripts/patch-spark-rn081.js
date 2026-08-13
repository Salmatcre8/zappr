/*
  Postinstall patch: @breeztech/breez-sdk-spark-react-native 0.22.0 references
  the bare `currentActivity` synthetic property in its Android passkey module.
  React Native 0.81 (Expo SDK 54) declares getCurrentActivity() as a Kotlin
  *function* on ReactContextBaseJavaModule, so the bare property reference
  doesn't resolve and compileDebugKotlin fails on EAS. Qualifying it through
  reactApplicationContext (a real property on ReactContext) compiles on both
  old and new RN. Drop this once the app moves past RN 0.81 or upstream fixes
  it (the module is generated — see its header comment).
*/
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'node_modules',
  '@breeztech',
  'breez-sdk-spark-react-native',
  'android',
  'src',
  'main',
  'kotlin',
  'com',
  'breeztech',
  'breezsdkspark',
  'BreezSdkSparkPasskeyModule.kt'
);

try {
  const src = fs.readFileSync(file, 'utf8');
  const patched = src.replace(
    /val activity = currentActivity\b/g,
    'val activity = reactApplicationContext.currentActivity'
  );
  if (patched !== src) {
    fs.writeFileSync(file, patched);
    console.log('[patch-spark-rn081] patched BreezSdkSparkPasskeyModule.kt');
  } else {
    console.log('[patch-spark-rn081] already patched or pattern gone — nothing to do');
  }
} catch (e) {
  console.warn('[patch-spark-rn081] skipped:', e.message);
}
