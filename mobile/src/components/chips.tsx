import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export type ChipTone = 'accent' | 'neg';

type Option = { value: string; label: string };

/**
 * Wrapping chip selector (web ToneToggle groups): single- or multi-select is the
 * caller's toggle logic — this just renders and reports taps.
 */
export function ChipGroup({
  options,
  selected,
  onToggle,
  tone = 'accent',
}: {
  options: readonly Option[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  tone?: ChipTone;
}) {
  const { theme } = useUnistyles();
  const activeColor = tone === 'neg' ? theme.colors.loss : theme.colors.primary;

  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            onPress={() => onToggle(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.chip,
              // Active state is background-only — text stays neutral.
              active && { backgroundColor: `${activeColor}26` },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  // iOS 26 bordered capsule — hairline carries the affordance; active tints the fill.
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
  pressed: { opacity: 0.6 },
  label: { fontSize: 13, fontWeight: '500', color: theme.colors.mutedForeground },
  labelActive: { color: theme.colors.foreground, fontWeight: '600' },
}));
