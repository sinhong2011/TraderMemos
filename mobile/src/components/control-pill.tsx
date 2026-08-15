import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

/**
 * Height of the pill the compact SwiftUI `DatePicker` draws for itself,
 * measured off it. Anything wearing this pill sits on the same baseline as a
 * date picker in the row above or below. The pill is a capsule, so this height
 * also sets its corner.
 */
export const CONTROL_PILL_HEIGHT = 34;

/**
 * The filled capsule iOS draws behind a compact picker's value.
 *
 * Hosted SwiftUI pickers (`DatePicker`, a menu `Picker`) paint this pill
 * themselves; anything else that has to sit beside one — a menu `Segmented`, a
 * plain value that acts as a control — wears it through this component so the
 * rows match instead of each screen re-measuring the system fill.
 */
export function ControlPill({ children }: { children: ReactNode }) {
  return <View style={styles.pill}>{children}</View>;
}

/**
 * The pill as a button — Android's stand-in for the controls SwiftUI draws
 * itself on iOS (the compact date pill, the seconds clock): the value sits in
 * the capsule and a tap hands off to a Material dialog.
 */
export function ControlPillButton({
  label,
  numeric,
  onPress,
}: {
  label: string;
  /** Tabular figures, so a ticking value doesn't reshape the pill. */
  numeric?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.pill, styles.button, pressed && styles.pressed]}
    >
      <Text style={[styles.label, numeric && styles.numeric]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  pill: {
    height: CONTROL_PILL_HEIGHT,
    justifyContent: 'center',
    // Capsule — the system pill rounds all the way, and at this height that is
    // the ceiling: anything past half of 34pt draws the same shape.
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    // iOS `tertiarySystemFill`; `muted` is too faint to hold its own beside a
    // system-drawn pill in the same row.
    backgroundColor: theme.colors.fill,
  },
  button: { paddingHorizontal: theme.spacing.md },
  pressed: { opacity: 0.6 },
  label: { fontSize: 15, color: theme.colors.foreground },
  numeric: { fontVariant: ['tabular-nums'] },
}));
