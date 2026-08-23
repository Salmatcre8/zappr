import { Text, View } from 'react-native';

import ZapprMark from './ZapprMark';
import { monoBold } from '@/lib/theme';

/*
  The zappr lockup (brand guidelines 03): the mark IS the z, so the wordmark
  only ever spells "appr" — writing "zappr" beside the mark sets the letter
  twice.

  Proportions come from logo/zappr-wordmark-ink.svg: the mark renders 1.15x the
  wordmark's cap size, and most of the gap is the mark's own side bearing (the
  glyph starts 20 units into a 100-unit box).
*/
export default function ZapprWordmark({
  size = 22,
  markColor,
  wordColor,
}: {
  /** Wordmark font size in px; the mark scales from it. */
  size?: number;
  markColor: string;
  wordColor: string;
}) {
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center' }}
      accessibilityRole="image"
      accessibilityLabel="zappr"
    >
      <ZapprMark size={Math.round(size * 1.15)} color={markColor} />
      <Text
        style={[
          monoBold,
          {
            color: wordColor,
            fontSize: size,
            lineHeight: size * 1.1,
            letterSpacing: size * -0.055,
            marginLeft: Math.max(1, Math.round(size * 0.03)),
          },
        ]}
      >
        appr
      </Text>
    </View>
  );
}
