import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Reanimated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

/** The header magnifier that opens the bar — `xmark` while it is open. */
export function SearchToggle({
  open,
  active,
  label,
  onPress,
}: {
  open: boolean;
  /** Tints the glyph while a query is filtering, so a collapsed row still reads. */
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <SymbolView
        name={open ? 'xmark' : 'magnifyingglass'}
        size={17}
        tintColor={active ? theme.colors.primary : theme.colors.foreground}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  pressed: { opacity: 0.6 },

  floatWrap: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
  },
  // The glass owns the capsule; the row inside owns the padding, so the
  // material covers the full pill rather than sitting behind an inset box.
  floatGlass: {
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  floatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: 48,
    paddingHorizontal: theme.spacing.lg,
  },
  floatInput: { flex: 1, fontSize: 16, color: theme.colors.foreground },
}));

/** Same spring the tab strips ride — one motion vocabulary across the app. */
const FLOAT_SPRING = { duration: 420, dampingRatio: 0.85 } as const;
/** How far below its resting place the bar waits while closed. */
const FLOAT_HIDDEN_OFFSET = 140;

/**
 * Floating bottom search — the iOS 26 placement, where search sits in reach of
 * a thumb rather than at the top of a list you have scrolled away from.
 *
 * It rides above the tab bar as real Liquid Glass (`GlassView`, which samples
 * the window behind it — correct here, unlike inside a sheet where it flattens
 * to a dark fill). The show/hide animation is **translate only**: iOS drops a
 * visual-effect view's backdrop for good once an ancestor's opacity leaves 1,
 * so fading this would permanently kill the material.
 *
 * A second translate tracks the keyboard, so the field stays above it as it
 * opens instead of being covered by it.
 */
export function FloatingSearchBar({
  open,
  value,
  placeholder,
  autoCapitalize = 'none',
  onChangeText,
  onSubmit,
  onClose,
}: {
  open: boolean;
  value: string;
  placeholder: string;
  /** `characters` for ticker fields, where every entry is upper case. */
  autoCapitalize?: 'none' | 'characters';
  onChangeText: (next: string) => void;
  /** Return key handler, for fields that commit rather than filter as you type. */
  onSubmit?: () => void;
  /** Called when the field asks to dismiss itself (the trailing ✕). */
  onClose: () => void;
}) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const input = useRef<TextInput>(null);

  useEffect(() => {
    // Opening the bar is a deliberate act — it should be typable at once.
    if (open) input.current?.focus();
    else input.current?.blur();
  }, [open]);

  // Seeded at the current state so a closed bar is simply parked off-screen on
  // the first frame. Springing straight from `useAnimatedStyle` starts at the
  // view's default translateY of 0, so on every mount the bar sat in view and
  // then slid itself away. The spring belongs to *toggling*, hence the effect.
  const offset = useSharedValue(open ? 0 : FLOAT_HIDDEN_OFFSET);
  useEffect(() => {
    offset.value = withSpring(open ? 0 : FLOAT_HIDDEN_OFFSET, FLOAT_SPRING);
  }, [open, offset]);
  const animated = useAnimatedStyle(() => ({
    transform: [
      { translateY: offset.value },
      // The bar already clears the home indicator, so only the keyboard height
      // beyond that inset is a lift it still owes.
      { translateY: -Math.max(0, keyboard.height.value - insets.bottom) },
    ],
  }));

  return (
    <Reanimated.View
      pointerEvents={open ? 'auto' : 'none'}
      style={[styles.floatWrap, { bottom: insets.bottom + 8 }, animated]}
    >
      <GlassView style={styles.floatGlass} glassEffectStyle="regular" isInteractive>
        <View style={styles.floatRow}>
          <SymbolView name="magnifyingglass" size={16} tintColor={theme.colors.mutedForeground} />
          <TextInput
            ref={input}
            value={value}
            onChangeText={onChangeText}
            autoCorrect={false}
            autoCapitalize={autoCapitalize}
            returnKeyType="search"
            onSubmitEditing={onSubmit}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.mutedForeground}
            style={styles.floatInput}
          />
          <Pressable
            onPress={() => (value.length > 0 ? onChangeText('') : onClose())}
            hitSlop={10}
            accessibilityRole="button"
          >
            <SymbolView
              name="xmark.circle.fill"
              size={16}
              tintColor={theme.colors.mutedForeground}
            />
          </Pressable>
        </View>
      </GlassView>
    </Reanimated.View>
  );
}
