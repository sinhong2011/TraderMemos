import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

type Option<T extends string> = { value: T; label: string; fill: string };

/**
 * Two-state toggle whose selected pill takes the option's own domain fill —
 * Long/Buy in profit green, Short/Sell in loss red — so the row states its
 * direction at a glance instead of leaving it to the label.
 *
 * Hand-rolled rather than `Segmented`: SwiftUI's segmented `Picker` paints its
 * own selection and ignores `.tint`, so a native control can't color the
 * selected segment. Neutral switches (chart ranges, calendar modes) stay on
 * `Segmented` and keep the system look.
 */
export function ValueToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  /** Exactly two — the pill is sized and stepped as half the track. */
  options: readonly [Option<T>, Option<T>];
  value: T;
  onChange: (value: T) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const index = options[1].value === value ? 1 : 0;
  const position = useSharedValue(index);
  const [first, second] = options;

  useEffect(() => {
    position.value = withSpring(index, SLIDE_SPRING);
  }, [index, position]);

  const segmentWidth = Math.max(0, trackWidth / 2 - TRACK_PADDING);
  const pill = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: position.value * segmentWidth }],
    // Travels with the pill: the fill crossfades over the same spring rather
    // than snapping to the new hue the moment the press lands.
    backgroundColor: interpolateColor(position.value, [0, 1], [first.fill, second.fill]),
  }));

  return (
    <View style={styles.track} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.pill, pill]} />
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={styles.segment}
          >
            <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Shorter than the pager's page spring — the pill travels a fraction as far. */
const SLIDE_SPRING = { duration: 260, dampingRatio: 0.9 } as const;
const TRACK_PADDING = 3;

const styles = StyleSheet.create((theme) => ({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: TRACK_PADDING,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.input,
  },
  // Under the labels, so text keeps its own color over the fill.
  pill: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
  },
  segment: {
    minWidth: 58,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  label: { fontSize: 13, fontWeight: '500', color: theme.colors.mutedForeground },
  labelActive: { color: '#FFFFFF', fontWeight: '600' },
}));
