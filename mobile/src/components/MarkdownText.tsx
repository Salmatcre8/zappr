import type { StyleProp, TextStyle } from 'react-native';
import { Text } from 'react-native';
import { mono, sansBold } from '@/lib/theme';

/*
  Minimal inline-Markdown renderer for agent replies: **bold**, *italic*,
  `code`. The model answers in Markdown; without this, bubbles show the
  literal asterisks. Lists and newlines pass through as plain text (they
  already read fine). Unmatched markers degrade to literal text.
*/
const TOKEN = /(\*\*.+?\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;

export default function MarkdownText({
  text,
  style,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={style}>
      {text.split(TOKEN).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <Text key={i} style={sansBold}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <Text key={i} style={[mono, { fontSize: 13 }]}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return (
            <Text key={i} style={{ fontStyle: 'italic' }}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}
