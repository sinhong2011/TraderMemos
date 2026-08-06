import { Button, HStack, Spacer, Text } from '@expo/ui/swift-ui';
import type { ButtonRole } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  listRowBackground,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useUnistyles } from 'react-native-unistyles';

/**
 * Form action button with a centered label — the iOS-settings idiom for
 * standalone actions (Save / Sign out / Delete …). Filled with the brand
 * `primary` (destructive actions keep the `destructive` fill) via
 * `borderedProminent`, matching the login screen's primary action. SwiftUI
 * left-aligns plain Button rows like navigation links, so the label is
 * centered with flanking Spacers.
 *
 * `disabled` is what an in-flight action should pass: swapping the label to
 * "Saving…" alone leaves the row tappable, so a double tap fires the mutation
 * twice (two accounts, two deletes).
 */
export function CenteredButton({
  label,
  role,
  disabled,
  onPress,
}: {
  label: string;
  role?: ButtonRole;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();

  return (
    <Button
      role={role}
      onPress={onPress}
      modifiers={[
        buttonStyle('borderedProminent'),
        controlSize('large'),
        tint(role === 'destructive' ? theme.colors.destructive : theme.colors.primary),
        // The Form row would otherwise draw its own inset-grouped grey capsule
        // behind the fill, reading as a wrapper box around the button.
        listRowBackground('#00000000'),
        disabledModifier(disabled ?? false),
      ]}
    >
      <HStack>
        <Spacer />
        <Text
          modifiers={[
            font({ size: 17, weight: 'semibold' }),
            foregroundStyle(theme.colors.primaryForeground),
          ]}
        >
          {label}
        </Text>
        <Spacer />
      </HStack>
    </Button>
  );
}
