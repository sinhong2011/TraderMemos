import type { ReactNode } from 'react';
import { View } from 'react-native';
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

const styles = StyleSheet.create((theme, rt) => ({
  // The fill is iOS `tertiarySystemFill` (one grey, two alphas); no theme token
  // is that strong — `muted` at 4% would leave the pill invisible next to a
  // system-drawn one.
  pill: {
    height: CONTROL_PILL_HEIGHT,
    justifyContent: 'center',
    // Capsule — the system pill rounds all the way, and at this height that is
    // the ceiling: anything past half of 34pt draws the same shape.
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    backgroundColor:
      rt.themeName === 'light' ? 'rgba(118, 118, 128, 0.12)' : 'rgba(118, 118, 128, 0.24)',
  },
}));
