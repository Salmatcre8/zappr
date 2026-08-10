import { Text, View } from 'react-native';
import { mono, sans, useZapprTheme } from '@/lib/theme';
import type { AgentContentBlock, AgentMessage } from '@/types/agent';

function textOf(content: AgentMessage['content']): string {
  if (typeof content === 'string') return content;
  return content
    .filter((b): b is Extract<AgentContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

function toolNames(content: AgentMessage['content']): string[] {
  if (typeof content === 'string') return [];
  return content
    .filter((b): b is Extract<AgentContentBlock, { type: 'tool_use' }> => b.type === 'tool_use')
    .map((b) => b.name.replace(/_/g, ' '));
}

/*
  Bubbles per the mobile mockup: user = orangeSoft fill + orange border,
  16px radius with a 5px tail corner bottom-right; assistant = recessed
  surface, tail bottom-left. Tool activity renders as small mono pills.
*/
export default function ChatMessage({ message }: { message: AgentMessage }) {
  const t = useZapprTheme();
  const isUser = message.role === 'user';

  // tool_result turns are protocol plumbing (role:user with block content) —
  // the agent's follow-up text is what the user should see.
  if (isUser && typeof message.content !== 'string') return null;

  const text = textOf(message.content);
  const tools = toolNames(message.content);
  if (!text && tools.length === 0) return null;

  if (isUser) {
    return (
      <View style={{ alignItems: 'flex-end' }}>
        <View
          style={{
            maxWidth: '82%',
            backgroundColor: t.orangeSoft,
            borderWidth: 1,
            borderColor: t.orange,
            borderRadius: 16,
            borderBottomRightRadius: 5,
            paddingHorizontal: 14,
            paddingVertical: 11,
          }}
        >
          <Text style={[sans, { color: t.bone, fontSize: 14.5, lineHeight: 22 }]}>{text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'flex-start', gap: 6 }}>
      {text ? (
        <View
          style={{
            maxWidth: '82%',
            backgroundColor: t.surface,
            borderRadius: 16,
            borderBottomLeftRadius: 5,
            paddingHorizontal: 14,
            paddingVertical: 11,
          }}
        >
          <Text style={[sans, { color: t.bone, fontSize: 14.5, lineHeight: 22 }]}>{text}</Text>
        </View>
      ) : null}
      {tools.map((name) => (
        <View
          key={name}
          style={{
            borderRadius: 999,
            backgroundColor: t.surface,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={[mono, { color: t.orange, fontSize: 10, fontWeight: '700' }]}>⚡ {name}</Text>
        </View>
      ))}
    </View>
  );
}
