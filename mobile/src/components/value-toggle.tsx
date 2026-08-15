import { cn } from 'panelui-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

type Option<T extends string> = { value: T; label: string; fill: string };

/**
 * Two-state toggle whose selected pill takes the option's own domain fill —
 * Long/Buy in profit green, Short/Sell in loss red — so the row states its
 * direction at a glance instead of leaving it to the label.
 *
 * Hand-rolled rather than `Segmented`: PanelUI's `Tabs` indicator is one
 * surface token for every tab, so a control whose selection color *is* the
 * information cannot be expressed with it. Neutral switches (chart ranges,
 * calendar modes) stay on `Segmented` and keep the standard look.
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
    <View
      className="flex-row items-center rounded-full bg-fill p-[3px]"
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {/* Under the labels, so text keeps its own color over the fill. The
          inset is the track's own padding, in points, because the pill is
          positioned against the track's box rather than laid out in it. */}
      <Animated.View
        className="absolute rounded-full"
        style={[{ top: TRACK_PADDING, bottom: TRACK_PADDING, left: TRACK_PADDING }, pill]}
      />
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            className="min-h-[28px] min-w-[58px] items-center justify-center px-3"
          >
            <Text
              className={cn(
                'text-[13px] font-medium text-muted-foreground',
                // White, not a token: the pill under it is a saturated P&L fill
                // that stays the same in both schemes (see PnlFill).
                isActive && 'font-semibold text-white'
              )}
              numberOfLines={1}
            >
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
