import { RNHostView } from '@expo/ui';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

/**
 * Form action button with a centered label, in its cross-platform form —
 * `centered-button.ios.tsx` keeps the SwiftUI `borderedProminent` original;
 * both export the same name, so the settings screens never branch.
 *
 * Same contract as iOS: `disabled` locks out the double tap an in-flight
 * mutation would otherwise take twice; `loading` adds the spinner as well.
 * Plain RN inside an `RNHostView` (the NavRow pattern) so it can sit in a
 * `FieldGroup` row on Android.
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
  const { theme } = useUnistyles();
  const locked = disabled || loading || false;

  return (
    <RNHostView matchContents>
      <Pressable
        onPress={onPress}
        disabled={locked}
        accessibilityRole="button"
        accessibilityState={{ disabled: locked }}
        style={({ pressed }) => [
          styles.button,
          role === 'destructive' && styles.destructive,
          pressed && styles.pressed,
          locked && styles.disabled,
        ]}
      >
        {loading ? <ActivityIndicator size="small" color={theme.colors.primaryForeground} /> : null}
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </RNHostView>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    minHeight: 50,
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
  },
  destructive: { backgroundColor: theme.colors.destructive },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  label: { fontSize: 17, fontWeight: '600', color: theme.colors.primaryForeground },
}));
