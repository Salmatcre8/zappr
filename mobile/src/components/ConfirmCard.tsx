import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { mono, sansBold, sansSemiBold, useZapprTheme } from '@/lib/theme';
import type { ConfirmRow } from './ConfirmSheet';

/*
  Inline confirm-before-send card, rendered INSIDE the agent conversation
  (mockup treatment) rather than as a modal — the approval reads as part of
  the chat. Wallet/zap flows outside the chat use ConfirmSheet instead.
*/
export default function ConfirmCard({
  title,
  rows,
  busy,
  onApprove,
  onCancel,
}: {
  title: string;
  rows: ConfirmRow[];
  busy?: boolean;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const t = useZapprTheme();
  return (
    <View
      style={{
        borderRadius: 16,
        padding: 15,
        backgroundColor: t.orangeSoft,
        borderWidth: 1,
        borderColor: t.orange,
      }}
    >
      <Text style={[mono, { color: t.orange, fontSize: 10, letterSpacing: 1.2, marginBottom: 9 }]}>
        CONFIRM BEFORE SEND
      </Text>
      <Text style={[sansBold, { color: t.bone, fontSize: 15.5, marginBottom: 10 }]}>{title}</Text>
      {rows.map((r) => (
        <View
          key={r.label + r.value}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 12,
            paddingVertical: 5,
          }}
        >
          <Text style={{ color: t.dim, fontSize: 13 }}>{r.label}</Text>
          <Text
            style={[
              mono,
              {
                color: r.accent ? t.orange : t.bone,
                fontWeight: r.accent ? '700' : '400',
                fontSize: 13,
                flexShrink: 1,
                textAlign: 'right',
              },
            ]}
          >
            {r.value}
          </Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 9, marginTop: 12 }}>
        <Pressable
          onPress={onApprove}
          disabled={busy}
          style={{
            flex: 1,
            backgroundColor: t.orange,
            borderRadius: 11,
            paddingVertical: 12,
            alignItems: 'center',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color={t.onOrange} />
          ) : (
            <Text style={[sansBold, { color: t.onOrange, fontSize: 14 }]}>Approve</Text>
          )}
        </Pressable>
        <Pressable
          onPress={onCancel}
          disabled={busy}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: t.line,
            borderRadius: 11,
            paddingVertical: 12,
            alignItems: 'center',
          }}
        >
          <Text style={[sansSemiBold, { color: t.dim, fontSize: 14 }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
