import { GlassView } from 'expo-glass-effect';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import Reanimated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { AnimatedSymbolSwap } from '@/components/animated-symbol-swap';

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
  const [foreground, primary] = useCSSVariable(['--color-foreground', '--color-primary']) as [
    string,
    string,
  ];
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="active:opacity-60"
    >
      <AnimatedSymbolSwap
        name={open ? 'xmark' : 'magnifyingglass'}
        size={17}
        tintColor={active ? primary : foreground}
      />
    </Pressable>
  );
}

/** Same spring the tab strips ride — one motion vocabulary across the app. */
const FLOAT_SPRING = { duration: 420, dampingRatio: 0.85 } as const;
/** How far below its resting place the bar waits while closed. */
const FLOAT_HIDDEN_OFFSET = 140;

/**
 * Floating bottom search — the placement where search sits in reach of a thumb
 * rather than at the top of a list you have scrolled away from.
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
  const [card, mutedForeground] = useCSSVariable([
    '--color-card',
    '--color-muted-foreground',
  ]) as [string, string];
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
      className="absolute left-4 right-4"
      style={[{ bottom: insets.bottom + 8 }, animated]}
    >
      {/* The glass owns the capsule; the row inside owns the padding, so the
          material covers the full pill rather than sitting behind an inset
          box. Off iOS, `GlassView` degrades to a plain transparent `View`, so
          the pill paints itself: elevated card fill plus a soft shadow to lift
          it off the list the way the glass refraction does. Styled by value
          rather than by class — the glass view is a native host, not one of
          the core components Uniwind styles. */}
      <GlassView
        style={{
          borderRadius: 9999,
          borderCurve: 'continuous',
          overflow: 'hidden',
          ...(Platform.OS !== 'ios' && {
            backgroundColor: card,
            boxShadow: '0 4 16 rgba(0, 0, 0, 0.25)',
          }),
        }}
        glassEffectStyle="regular"
        isInteractive
      >
        <View className="h-12 flex-row items-center gap-2 px-4">
          <Icon name="magnifyingglass" size={16} tintColor={mutedForeground} />
          <TextInput
            ref={input}
            value={value}
            onChangeText={onChangeText}
            autoCorrect={false}
            autoCapitalize={autoCapitalize}
            returnKeyType="search"
            onSubmitEditing={onSubmit}
            placeholder={placeholder}
            placeholderTextColor={mutedForeground}
            className="flex-1 text-base text-foreground"
          />
          <Pressable
            onPress={() => (value.length > 0 ? onChangeText('') : onClose())}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Icon name="xmark.circle.fill" size={16} tintColor={mutedForeground} />
          </Pressable>
        </View>
      </GlassView>
    </Reanimated.View>
  );
}
