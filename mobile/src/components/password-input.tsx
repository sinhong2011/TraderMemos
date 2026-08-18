import { t } from '@lingui/core/macro';
import { cn, Input, type InputProps } from 'panelui-native';
import { useState, type Ref } from 'react';
import { Pressable, TextInput } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';

// PanelUI's own prop surface, so `description` / `errorMessage` / `label`
// pass through — this is an `Input` wearing a reveal toggle, nothing less.
type PasswordInputProps = Omit<InputProps, 'secureTextEntry' | 'endContent'> & {
  ref?: Ref<TextInput>;
};

/**
 * Password field with an eye toggle to reveal the value — the auth screen's
 * `Input`, with the toggle as trailing content inside the field rather than a
 * control parked beside it. The caller supplies the label and any card chrome
 * around it, exactly as it does for the plain fields it sits with.
 */
export function PasswordInput({ ref, className, ...props }: PasswordInputProps) {
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  const [visible, setVisible] = useState(false);

  return (
    <Input
      ref={ref}
      variant="filled"
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      textContentType="password"
      // Matches the sibling fields on the sign-in screen; a caller's own
      // classes still win, since they are merged last.
      className={cn('min-h-[52px] rounded-3xl border-0 text-[17px]', className)}
      endContent={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? t`Hide password` : t`Show password`}
          hitSlop={8}
          className="min-h-7 min-w-7 items-center justify-center active:opacity-50"
        >
          <Icon name={visible ? 'eye.slash' : 'eye'} size={18} tintColor={mutedForeground} />
        </Pressable>
      }
      {...props}
    />
  );
}
