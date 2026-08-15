import { t } from '@lingui/core/macro';
import { useState, type Ref } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';

type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry'> & {
  ref?: Ref<TextInput>;
};

/**
 * Password field with an eye toggle to reveal the value. Renders as a bare
 * input row like the login card's TextInputs — the caller supplies the
 * surrounding card/label chrome.
 */
export function PasswordInput({ ref, style, ...props }: PasswordInputProps) {
  const { theme } = useUnistyles();
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.row}>
      <TextInput
        ref={ref}
        secureTextEntry={!visible}
        placeholderTextColor={theme.colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        style={[styles.input, style]}
        {...props}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? t`Hide password` : t`Show password`}
        hitSlop={8}
        style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
      >
        <Icon
          name={visible ? 'eye.slash' : 'eye'}
          size={18}
          tintColor={theme.colors.mutedForeground}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  input: {
    flex: 1,
    fontSize: 17,
    paddingVertical: theme.spacing.xs,
    color: theme.colors.foreground,
  },
  toggle: { justifyContent: 'center', minWidth: 28, minHeight: 28, alignItems: 'center' },
  togglePressed: { opacity: 0.5 },
}));
