import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import ZapprMark from '@/components/ZapprMark';
import { useZapprTheme } from '@/lib/theme';
import { restoreSession } from '@/lib/session';

/*
  Cold-start bootstrap: silently restore the previous session (web
  refresh-safety parity) and land on the app; otherwise show login.

  Carries the mark so the handoff from the native splash reads as one
  continuous screen rather than a bare spinner.
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
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: t.bg,
        gap: 28,
      }}
    >
      <ZapprMark size={64} color={t.orange} />
      <ActivityIndicator color={t.faint} />
    </View>
  );
}
