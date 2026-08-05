import { Button, HStack, Spacer, Text } from '@expo/ui/swift-ui';
import type { ButtonRole } from '@expo/ui/swift-ui';

/**
 * Form action button with a centered label — the iOS-settings idiom for
 * standalone actions (Save / Sign out / Delete …). SwiftUI left-aligns
 * plain Button rows like navigation links, so the label is centered with
 * flanking Spacers; the role still tints custom label content.
 */
export function CenteredButton({
  label,
  role,
  onPress,
}: {
  label: string;
  role?: ButtonRole;
  onPress: () => void;
}) {
  return (
    <Button role={role} onPress={onPress}>
      <HStack>
        <Spacer />
        <Text>{label}</Text>
        <Spacer />
      </HStack>
    </Button>
  );
}
