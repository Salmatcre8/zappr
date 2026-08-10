import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { sansBold, useZapprTheme } from '@/lib/theme';

/*
  Bottom sheet per the mockup: dim backdrop, panel with 22px top radius and a
  drag handle. Used for wallet receive/send/backup; ConfirmSheet builds on it.
*/
export default function BottomSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useZapprTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          onPress={onClose}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.38)' }}
        />
        <View
          style={{
            backgroundColor: t.panel,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 26,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 15,
            shadowOffset: { width: 0, height: -12 },
            elevation: 12,
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: t.line,
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />
          {title ? (
            <Text style={[sansBold, { color: t.bone, fontSize: 17, marginBottom: 14 }]}>{title}</Text>
          ) : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
