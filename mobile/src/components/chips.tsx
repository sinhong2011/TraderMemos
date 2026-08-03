import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export type ChipTone = 'accent' | 'neg';

/** Multi-select groups mark their picks; single-select ones behave like radios. */
export type ChipSelect = 'single' | 'multi';

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
  select = 'multi',
}: {
  options: readonly Option[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  tone?: ChipTone;
  select?: ChipSelect;
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
            // The capsule is ~32pt tall; the slop brings the target to 44.
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole={select === 'single' ? 'radio' : 'checkbox'}
            accessibilityState={{ selected: active, checked: active }}
            style={({ pressed }) => [
              styles.chip,
              // Selection reads from the fill *and* the outline — a tinted fill
              // alone was near-invisible in a long group (11 emotions). The label
              // stays neutral: primary is a fill-only color (see pill.tsx).
              active && { backgroundColor: `${activeColor}2E`, borderColor: `${activeColor}80` },
              pressed && styles.pressed,
            ]}
          >
            {/* Only multi-select marks its picks — the checkmark is what says
                "you can choose several here" without a word of copy. */}
            {select === 'multi' && active ? (
              <SymbolView name="checkmark" size={11} weight="bold" tintColor={activeColor} />
            ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 1,
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
