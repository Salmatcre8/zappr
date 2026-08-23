import { Image, Text, View } from 'react-native';
import { mono } from '@/lib/theme';

/*
  Feed avatar per the mobile mockup: rounded square (12px radius at 40px),
  solid hsl(hue 42% 44%) fill with a white mono initial; hue derived from
  the pubkey so authors stay recognizable without profile images.
*/
export default function Avatar({
  pubkey,
  picture,
  name,
  size = 40,
}: {
  pubkey: string;
  picture?: string;
  name?: string;
  size?: number;
}) {
  const radius = Math.round((12 * size) / 40);
  if (picture) {
    return (
      <Image
        source={{ uri: picture }}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }
  const hue = (parseInt(pubkey.slice(0, 4), 16) || 0) % 360;
  const initial = (name || pubkey).trim().charAt(0).toLowerCase() || '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: `hsl(${hue}, 42%, 44%)`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={[mono, { color: '#fff', fontSize: size * 0.38, fontWeight: '700' }]}>
        {initial}
      </Text>
    </View>
  );
}
