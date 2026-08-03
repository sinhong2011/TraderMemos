import { Form } from '@expo/ui/swift-ui';
import {
  background,
  listSectionSpacing,
  scrollContentBackground,
} from '@expo/ui/swift-ui/modifiers';
import type { ComponentProps } from 'react';
import { useUnistyles } from 'react-native-unistyles';

/**
 * `Form` with the app's settings styling: the system grouped background is
 * replaced by the app background token and the default iOS section gaps are
 * tightened. Row labels keep the native neutral color — no form-wide tint,
 * which would repaint every navigation label brand-blue. Extra `modifiers`
 * append after the shared set.
 */
export function SettingsForm({ modifiers = [], ...props }: ComponentProps<typeof Form>) {
  const { theme } = useUnistyles();
  return (
    <Form
      modifiers={[
        scrollContentBackground('hidden'),
        background(theme.colors.background),
        listSectionSpacing('compact'),
        ...modifiers,
      ]}
      {...props}
    />
  );
}
