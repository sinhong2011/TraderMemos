import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';

/** Modal creation-form scaffold: Cancel · title · Save header over scrollable fields. */
export function FormSheet({
  title,
  saving,
  onSave,
  children,
}: {
  title: string;
  saving?: boolean;
  onSave: () => void;
  children: ReactNode;
}) {
  const { theme } = useUnistyles();
  const router = useRouter();

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.cancel}>{t`Cancel`}</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <Pressable
          onPress={onSave}
          disabled={saving}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          {saving ? (
            <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
          ) : (
            <Text style={styles.save}>{t`Save`}</Text>
          )}
        </Pressable>
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.grow}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {/* Decimal pads have no return key — tapping any empty space dismisses.
              Inputs and controls handle their own taps, so this never intercepts. */}
          <Pressable onPress={Keyboard.dismiss} accessible={false} style={styles.content}>
            {children}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

/** Filled, bordered input matching the auth screen's fields. */
export function FormInput({ style, multiline, ...props }: TextInputProps) {
  const { theme } = useUnistyles();
  return (
    <View style={[styles.shell, multiline && styles.shellMultiline]}>
      <TextInput
        placeholderTextColor={theme.colors.mutedForeground}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline, style]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  title: { fontSize: 17, fontWeight: '600', color: theme.colors.foreground },
  cancel: { fontSize: 16, color: theme.colors.mutedForeground },
  save: { fontSize: 16, fontWeight: '600', color: theme.colors.foreground },
  pressed: { opacity: 0.6 },
  grow: { flexGrow: 1 },
  content: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  field: { gap: theme.spacing.sm },
  label: { fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  shell: {
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg + 2,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.input,
    backgroundColor: theme.colors.card,
  },
  shellMultiline: { minHeight: 120, justifyContent: 'flex-start' },
  input: { fontSize: 16, paddingVertical: theme.spacing.sm, color: theme.colors.foreground },
  inputMultiline: { minHeight: 104, textAlignVertical: 'top' },
}));
