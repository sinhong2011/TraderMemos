import { t } from '@lingui/core/macro';
import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { tick } from '@/lib/haptics';

/**
 * Rating indicator — a row of stars standing in for a rank (HIG "Rating
 * indicators").
 *
 * Apple only ships the control on macOS (`NSLevelIndicator`, rating style), so
 * there is no SwiftUI equivalent for `@expo/ui` to host: this is plain RN over
 * SF Symbols, which is also what the rest of this form is (see form-rows.tsx).
 * The HIG rules it does follow are the ones that survive the port — whole
 * symbols only (no halves), a fixed gap that never stretches to fill the row,
 * and the star itself, because a custom glyph would stop reading as a rank.
 */

const STAR_SIZE = 24;
const STAR_GAP = 12;
/** One star's share of the track — what a touch x is divided by to get a rank. */
const SLOT = STAR_SIZE + STAR_GAP;
/** Snappier than the 420ms page spring: a star should land under the finger. */
const STAR_SPRING = { duration: 260, dampingRatio: 0.62 } as const;

function Star({ filled, tint }: { filled: boolean; tint: string }) {
  // Empty stars sit slightly small so filling one reads as a pop, not a recolor.
  const pop = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(filled ? 1 : 0.88, STAR_SPRING) }],
  }));
  return (
    <Animated.View style={pop}>
      <SymbolView name={filled ? 'star.fill' : 'star'} size={STAR_SIZE} tintColor={tint} />
    </Animated.View>
  );
}

export function RatingIndicator({
  label,
  value,
  onChange,
  caption,
  count = 5,
}: {
  /** Spoken name of the control — the row label, repeated for VoiceOver. */
  label: string;
  /** 1…count, or 0 for unrated. */
  value: number;
  onChange: (value: number) => void;
  /** Optional trailing value text (the letter grade behind the stars). */
  caption?: string;
  count?: number;
}) {
  const { theme } = useUnistyles();

  // Per-gesture bookkeeping: the rank the finger landed on, and the last rank
  // emitted. Shared values, not refs — a ref read inside a handler built during
  // render is exactly what the compiler lint forbids, and these are only ever
  // touched from the gesture callbacks anyway.
  const startRank = useSharedValue(0);
  const lastRank = useSharedValue(0);

  const rank = (x: number) => Math.min(count, Math.max(1, Math.ceil(x / SLOT)));

  const pick = (x: number) => {
    const next = rank(x);
    if (next === lastRank.value) return;
    lastRank.value = next;
    tick();
    onChange(next);
  };

  const scrub = Gesture.Pan()
    // minDistance(0) makes the pan fire on touch-down, so one gesture covers
    // both a tap and a drag across the track — no Tap/Pan race to arbitrate.
    .minDistance(0)
    // `pick` calls back into React state; workletizing it would throw.
    .runOnJS(true)
    .onBegin((e) => {
      // `value` is only ever moved by this gesture, so at touch-down the prop
      // is current — mid-drag the handlers instead compare against `lastRank`.
      startRank.value = value;
      lastRank.value = value;
      pick(e.x);
    })
    .onUpdate((e) => pick(e.x))
    .onFinalize(() => {
      // Tapping the star that already holds the rank clears it — the same
      // "tap the active one to unset" rule the chip rows in this form use.
      if (lastRank.value !== startRank.value || startRank.value === 0) return;
      tick();
      onChange(0);
    });

  const adjust = (delta: number) => {
    const next = Math.min(count, Math.max(0, value + delta));
    if (next === value) return;
    onChange(next);
  };

  return (
    <View
      // One adjustable control, not five buttons: VoiceOver swipes the rank up
      // and down instead of walking star by star.
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: count, now: value, text: caption || t`Not rated` }}
      accessibilityHint={t`Tap the current rating to clear it.`}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) =>
        adjust(event.nativeEvent.actionName === 'increment' ? 1 : -1)
      }
      style={styles.wrap}
    >
      <GestureDetector gesture={scrub}>
        {/* The stars are 24pt tall; the padding brings the touch track to 44. */}
        <View style={styles.track}>
          {Array.from({ length: count }, (_, index) => (
            <Star
              key={index}
              filled={index < value}
              tint={index < value ? theme.colors.primary : theme.colors.mutedForeground}
            />
          ))}
        </View>
      </GestureDetector>
      {caption ? (
        <Text style={styles.caption} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  track: { flexDirection: 'row', gap: STAR_GAP, paddingVertical: (44 - STAR_SIZE) / 2 },
  caption: { fontSize: 15, fontWeight: '600', color: theme.colors.mutedForeground },
}));
