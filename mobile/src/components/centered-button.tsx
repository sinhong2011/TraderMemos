import { Button } from 'panelui-native';

/**
 * Form action button with a centered label — the standalone action at the foot
 * of a settings screen or a sheet (Save / Sign out / Delete …).
 *
 * One file for both platforms now: the SwiftUI `borderedProminent` original
 * (`centered-button.ios.tsx`) and its hand-drawn Material twin have both been
 * replaced by PanelUI's `Button`, which centers its label and fills the row on
 * its own. Spacing around it belongs to the container, not to the button.
 *
 * `disabled` is what an in-flight action should pass: swapping the label to
 * "Saving…" alone leaves the row tappable, so a double tap fires the mutation
 * twice (two accounts, two deletes). `loading` does both — a spinner ahead of
 * the label, and the same lock-out — for actions long enough that a relabelled
 * button alone reads as a frozen screen.
 */
export function CenteredButton({
  label,
  role,
  disabled,
  loading,
  onPress,
}: {
  label: string;
  role?: 'default' | 'cancel' | 'destructive';
  disabled?: boolean;
  /** In-flight: shows a spinner beside the label and blocks further taps. */
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      variant={
        role === 'destructive' ? 'destructive' : role === 'cancel' ? 'secondary' : 'primary'
      }
      size="md"
      className="rounded-3xl"
      fullWidth
      disabled={disabled}
      loading={loading}
      onPress={onPress}
    >
      {label}
    </Button>
  );
}
