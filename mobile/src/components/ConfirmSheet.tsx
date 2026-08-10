import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import BottomSheet from './BottomSheet';
import { mono, sansBold, sansSemiBold, useZapprTheme } from '@/lib/theme';

/*
  Confirm-before-send — EVERY payment, zap, or public post goes through an
  explicit approval; the agent and the wallet screens both use this. Core
  trust guarantee: nothing moves money or posts publicly without APPROVE.
*/
export type ConfirmRow = { label: string; value: string; accent?: boolean };

export default function ConfirmSheet({
  visible,
  title,
  rows,
  note,
  busy,
  onApprove,
  onCancel,
}: {
  visible: boolean;
  title: string;
  rows: ConfirmRow[];
  note?: string;
  busy?: boolean;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const t = useZapprTheme();
  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <Text
        style={[
          mono,
          { color: t.orange, fontSize: 10, letterSpacing: 1.4, marginBottom: 9 },
        ]}
      >
        CONFIRM BEFORE SEND
      </Text>
      <Text style={[sansBold, { color: t.bone, fontSize: 15.5, marginBottom: 10 }]}>{title}</Text>

      <View style={{ gap: 2, marginBottom: 4 }}>
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
      </View>

      {note ? <Text style={{ color: t.faint, fontSize: 12, marginBottom: 4 }}>{note}</Text> : null}

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
    </BottomSheet>
  );
}
