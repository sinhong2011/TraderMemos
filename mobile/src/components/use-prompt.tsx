import { Button, Input, Scrim } from 'panelui-native';
import { useState, type ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  type KeyboardTypeOptions,
} from 'react-native';

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
 * verbatim; elsewhere it raises an RN `Modal` dialog. Screens render `element`
 * once at their root — it is `null` whenever no prompt is up (and always on
 * iOS).
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
  // Seeded once per prompt — the dialog unmounts when it closes.
  const [text, setText] = useState(options.defaultValue ?? '');

  const submit = () => {
    onClose();
    options.onSubmit(text);
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1 items-center justify-center p-6">
        <Scrim />
        <Pressable className="absolute bottom-0 left-0 right-0 top-0" onPress={onClose} />
        <View className="self-stretch gap-3 rounded-2xl bg-popover p-6">
          <Text className="text-lg font-semibold text-popover-foreground">{options.title}</Text>
          {options.message ? (
            <Text className="text-sm text-muted-foreground">{options.message}</Text>
          ) : null}
          <Input
            variant="filled"
            className="rounded-3xl border-0"
            autoFocus
            value={text}
            onChangeText={setText}
            keyboardType={options.keyboardType}
            onSubmitEditing={submit}
          />
          <View className="flex-row justify-end gap-2">
            <Button variant="ghost" onPress={onClose}>
              {t`Cancel`}
            </Button>
            <Button variant="ghost" onPress={submit}>
              {options.confirmLabel ?? t`Save`}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
