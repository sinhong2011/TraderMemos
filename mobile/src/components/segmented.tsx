import { Picker } from '@expo/ui';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { AppHost } from '@/components/app-host';
import { Icon } from '@/components/icon';

import type { SegmentedProps } from './segmented.types';

/**
 * The single-choice control, in its cross-platform form. `segmented.ios.tsx`
 * keeps the SwiftUI `Picker` and its three `pickerStyle`s; both export the same
 * name, so the 16 call sites never branch. (As with `settings-form`, the
 * universal file has to be the unsuffixed one — TypeScript only resolves the
 * base name.)
 *
 * The two halves are split because `@expo/ui`'s universal `Picker` only offers
 * `appearance: 'menu' | 'wheel'` — there is no segmented appearance at all, so
 * the app's default variant has no universal primitive to sit on:
 *
 * - **segmented** is drawn here in React Native. Compose does ship
 *   `SingleChoiceSegmentedButtonRow`, but it is Material's outlined pill row —
 *   visually a different control from the iOS track this replaces, and it would
 *   drag the dashboard cards away from DESIGN.md's tokens. A track on `fill`
 *   with the active segment on `segmentActive` is the same shape on both
 *   platforms, and `segmentActive` exists for exactly this.
 * - **menu** and **wheel** go through the universal `Picker`, which is the very
 *   same SwiftUI picker on iOS and a Compose dropdown on Android. `wheel` has no
 *   Compose drum, so it degrades to that dropdown — acceptable, since the two
 *   wheel call sites (the calendar's month/year overlay) are choosing from a
 *   flat list either way.
 *
 * `compact` and `fill` size the RN track directly; `flush` is a SwiftUI menu
 * inset that has no Compose counterpart and is ignored here.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  variant = 'segmented',
  compact,
  fill,
  flush: _iosFlush,
}: SegmentedProps<T>) {
  const { theme } = useUnistyles();

  if (variant !== 'segmented') {
    return (
      <AppHost matchContents={!fill} style={fill ? styles.stretch : undefined}>
        <Picker
          appearance={variant === 'wheel' ? 'wheel' : 'menu'}
          selectedValue={value}
          onValueChange={(selection) => onChange(selection as T)}
        >
          {options.map((option) => (
            <Picker.Item key={option.value} label={option.label} value={option.value} />
          ))}
        </Picker>
      </AppHost>
    );
  }

  const allIcons = options.every((option) => option.icon != null);

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.track, compact && styles.compact, fill && styles.stretch]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              styles.segment,
              // Segments share the width only when the track was told to
              // stretch; hugging, they size to their own label — `flex: 1`
              // there zeroes the basis and the labels spill out of the track.
              fill && styles.segmentFill,
              active && styles.segmentActive,
              pressed && !active && styles.segmentPressed,
            ]}
          >
            {allIcons && option.icon ? (
              <Icon
                name={option.icon}
                size={15}
                tintColor={active ? theme.colors.foreground : theme.colors.mutedForeground}
              />
            ) : (
              <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
                {option.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  stretch: { alignSelf: 'stretch' },
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    flexShrink: 1,
    padding: 2,
    gap: 2,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.fill,
  },
  compact: { height: 30 },
  segment: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
  },
  segmentFill: { flex: 1 },
  // The active page reads as a cut-out of the page it controls — see the token.
  segmentActive: { backgroundColor: theme.colors.segmentActive },
  segmentPressed: { opacity: 0.6 },
  label: { fontSize: 13, fontWeight: '500', color: theme.colors.mutedForeground },
  labelActive: { color: theme.colors.foreground, fontWeight: '600' },
}));
