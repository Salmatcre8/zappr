import '@/lib/polyfills';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View } from 'react-native';

import Toast from '@/components/Toast';
import { palettes } from '@/lib/theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const p = scheme === 'dark' ? palettes.dark : palettes.light;
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: p.orange,
      background: p.bg,
      card: p.panel,
      text: p.bone,
      border: p.line,
      notification: p.orange,
    },
  };

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" />
        </Stack>
        <Toast />
      </View>
    </ThemeProvider>
  );
}
