import { useState, type ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';

export interface PromptOptions {
  title: string;
  message?: string;
  defaultValue?: string;
  keyboardType?: KeyboardTypeOptions;
  /** The commit label — Save, Add, Rename … */
  confirmLabel?: string;
  onSubmit: (text: string) => void;
}

/**
 * Single-value editing, cross-platform. The iOS settings idiom is
 * `Alert.prompt` (see trading-journal), but that API does not exist on
 * Android, so this hook wraps it: on iOS `prompt()` calls `Alert.prompt`
 * verbatim; elsewhere it raises an RN `Modal` dialog styled like a Material
 * alert. Screens render `element` once at their root — it is `null` whenever
 * no prompt is up (and always on iOS).
 */
export function usePrompt(): {
  prompt: (options: PromptOptions) => void;
  element: ReactNode;
} {
  const [options, setOptions] = useState<PromptOptions | null>(null);

  const prompt = (next: PromptOptions) => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        next.title,
        next.message,
        [
          { text: t`Cancel`, style: 'cancel' },
          { text: next.confirmLabel ?? t`Save`, onPress: (text?: string) => next.onSubmit(text ?? '') },
        ],
        'plain-text',
        next.defaultValue ?? '',
        next.keyboardType,
      );
      return;
    }
    setOptions(next);
  };

  return {
    prompt,
    element: options ? <PromptDialog options={options} onClose={() => setOptions(null)} /> : null,
  };
}

function PromptDialog({ options, onClose }: { options: PromptOptions; onClose: () => void }) {
  const { theme } = useUnistyles();
  // Seeded once per prompt — the dialog unmounts when it closes.
  const [text, setText] = useState(options.defaultValue ?? '');

  const submit = () => {
    onClose();
    options.onSubmit(text);
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.scrim}>
        <Pressable style={styles.scrimTouch} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>{options.title}</Text>
          {options.message ? <Text style={styles.message}>{options.message}</Text> : null}
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            keyboardType={options.keyboardType}
            placeholderTextColor={theme.colors.mutedForeground}
            style={styles.input}
            onSubmitEditing={submit}
          />
          <View style={styles.actions}>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
              <Text style={styles.action}>{t`Cancel`}</Text>
            </Pressable>
            <Pressable onPress={submit} hitSlop={8} accessibilityRole="button">
              <Text style={styles.action}>{options.confirmLabel ?? t`Save`}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  scrimTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  card: {
    alignSelf: 'stretch',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.lg + 6,
    backgroundColor: theme.colors.card,
  },
  title: { fontSize: 18, fontWeight: '600', color: theme.colors.foreground },
  message: { fontSize: 14, color: theme.colors.mutedForeground },
  input: {
    fontSize: 16,
    color: theme.colors.foreground,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.xl,
    marginTop: theme.spacing.sm,
  },
  action: { fontSize: 15, fontWeight: '600', color: theme.colors.primary },
}));
