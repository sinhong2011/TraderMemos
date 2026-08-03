import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';
import { GlassButton, GlassIconButton } from '@/components/glass-button';

/**
 * Vertical form scroll area with native keyboard insets and tap-to-dismiss.
 * No KeyboardAvoidingView: inside a sheet it measures against window
 * coordinates and shifts the content up under the header even with the
 * keyboard closed — the scroll view's own insets behave correctly.
 */
export function FormScrollArea({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.grow}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      {/* Decimal pads have no return key — tapping any empty space dismisses.
          Inputs and controls handle their own taps, so this never intercepts. */}
      <Pressable onPress={Keyboard.dismiss} accessible={false} style={styles.content}>
        {children}
      </Pressable>
    </ScrollView>
  );
}

/**
 * Creation-form sheet scaffold, iOS 26 chrome: circular glass close on the
 * left, glassProminent Save on the right. `scroll` (default) wraps children
 * in a FormScrollArea; pass `scroll={false}` when the screen manages its own
 * scrolling (e.g. the trade form's symbol pager owns one scroll per page).
 */
export function FormSheet({
  title,
  saving,
  scroll = true,
  headerAccessory,
  saveLabel,
  savingLabel,
  hideClose = false,
  onSave,
  children,
}: {
  title: string;
  saving?: boolean;
  scroll?: boolean;
  /** Extra control rendered beside Save (e.g. the trade form's Import menu). */
  headerAccessory?: ReactNode;
  /** Names the commit for flows where "Save" is wrong (Generate, Done…). */
  saveLabel?: string;
  savingLabel?: string;
  /** Drops the cancel affordance when the work is already committed. */
  hideClose?: boolean;
  onSave: () => void;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          {hideClose ? null : (
            <GlassIconButton
              systemImage="xmark"
              label={t`Cancel`}
              onPress={() => router.back()}
            />
          )}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.headerSide, styles.headerEnd]}>
          {headerAccessory}
          <GlassButton
            label={saving ? (savingLabel ?? t`Saving…`) : (saveLabel ?? t`Save`)}
            prominent
            disabled={saving}
            onPress={onSave}
          />
        </View>
      </View>
      {scroll ? (
        <FormScrollArea>{children}</FormScrollArea>
      ) : (
        <View style={styles.flex}>{children}</View>
      )}
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
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    // Sheets show the grabber above — keep the chrome tight beneath it.
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  headerSide: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerEnd: { justifyContent: 'flex-end', gap: theme.spacing.sm },
  title: {
    flexShrink: 1,
    maxWidth: '55%',
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
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
