import { Text, View } from 'react-native';
import { useZapprTheme } from '@/lib/theme';
import { useToastStore } from '@/store/useToastStore';

/** Dark pill toast, floating above the tab bar (mockup treatment). */
export default function Toast() {
  const t = useZapprTheme();
  const message = useToastStore((s) => s.message);
  if (!message) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 20, right: 20, bottom: 96, zIndex: 70, alignItems: 'center' }}
    >
      <View
        style={{
          backgroundColor: t.bone,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 13,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 13,
          shadowOffset: { width: 0, height: 10 },
          elevation: 6,
        }}
      >
        <Text style={{ color: t.bg, fontSize: 13.5, fontWeight: '500', textAlign: 'center' }}>
          {message}
        </Text>
      </View>
    </View>
  );
}
