import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useZapprTheme } from '@/lib/theme';

/*
  Three tabs per the mobile mockup — Wallet is the default/first tab.
  Settings is a pushed screen (from the Wallet header), not a tab.
*/
export default function TabsLayout() {
  const t = useZapprTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.orange,
        tabBarInactiveTintColor: t.faint,
        tabBarStyle: { backgroundColor: t.panel, borderTopColor: t.line },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <Ionicons name="flash-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="agent"
        options={{
          title: 'Agent',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
