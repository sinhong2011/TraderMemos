import type { ReactNode } from 'react';
import { cn } from 'panelui-native';
import { Pressable, Text, View } from 'react-native';

/**
 * Height of the compact value pill, and the baseline every control that has to
 * sit beside one shares. The pill is a capsule, so this height also sets its
 * corner.
 */
export const CONTROL_PILL_HEIGHT = 34;

/**
 * The filled capsule behind a compact picker's value.
 *
 * A plain value that acts as a control — a date, a clock, a chosen name — wears
 * it so rows of them line up instead of each screen re-measuring the fill.
 *
 * `h-[34px]` rather than a class built from `CONTROL_PILL_HEIGHT`: Uniwind
 * compiles class strings ahead of time, so the number has to be spelled out.
 */
export function ControlPill({ children }: { children: ReactNode }) {
  return <View className="h-[34px] justify-center rounded-full bg-fill">{children}</View>;
}

/**
 * The pill as a button — the value sits in the capsule and a tap hands off to
 * the picker that owns it.
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
      className="h-[34px] justify-center rounded-full bg-fill px-3 active:opacity-60"
    >
      <Text className={cn('text-[15px] text-foreground', numeric && 'tabular-nums')}>
        {label}
      </Text>
    </Pressable>
  );
}
