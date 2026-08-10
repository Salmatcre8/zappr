import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useZapprTheme } from '@/lib/theme';
import { restoreSession } from '@/lib/session';

/*
  Cold-start bootstrap: silently restore the previous session (web
  refresh-safety parity) and land on the app; otherwise show login.
*/
export default function Index() {
  const t = useZapprTheme();

  useEffect(() => {
    let cancelled = false;
    restoreSession().then((ok) => {
      if (!cancelled) router.replace(ok ? '/(tabs)' : '/login');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
      <ActivityIndicator color={t.orange} />
    </View>
  );
}
