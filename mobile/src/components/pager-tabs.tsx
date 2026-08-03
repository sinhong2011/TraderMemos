import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

/** The app's one tab/page spring (trade-form conventions). */
const TAB_SPRING = { duration: 420, dampingRatio: 0.85 } as const;

type Option<T extends string> = { value: T; label: string };

function Tab({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const fill = useAnimatedStyle(() => ({ opacity: withSpring(isActive ? 1 : 0, TAB_SPRING) }));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
    >
      <Animated.View pointerEvents="none" style={[styles.tabFill, fill]} />
      <Text
        style={[styles.tabLabel, isActive && styles.tabLabelActive]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Capsule pill tabs for pager sections — the trade form's SymbolPagerBar
 * visual language (card capsule track, input-colored active pill, the shared
 * 420ms/0.85 spring) generalized to a fixed option set. Equal-width tabs so
 * five sections fit a phone without scrolling.
 */
export function PagerTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.track}>
      {options.map((option) => (
        <Tab
          key={option.value}
          label={option.label}
          isActive={option.value === value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 2,
    padding: 3,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    // iOS 26 bordered capsule — the hairline carries the affordance (chips.tsx).
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
  },
  pressed: { opacity: 0.7 },
  tabFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.input,
    // Start hidden so the animated opacity has a defined origin.
    opacity: 0,
  },
  tabLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.mutedForeground },
  tabLabelActive: { color: theme.colors.foreground, fontWeight: '600' },
}));
