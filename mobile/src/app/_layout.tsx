import '@/lib/polyfills';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View } from 'react-native';

import Toast from '@/components/Toast';
import { palettes } from '@/lib/theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    SpaceMono_400Regular,
    SpaceMono_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
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

  if (!fontsLoaded) return null; // splash stays visible until the brand fonts arrive

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="spike-passkey" />
        </Stack>
        <Toast />
      </View>
    </ThemeProvider>
  );
}
