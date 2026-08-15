import { useEffect, useState } from 'react';
import { View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { isRollArmed } from '@/lib/rolling-numbers';

/** Matches the web keyframes so both platforms roll at the same pace. */
const ROLL_MS = 420;
/** How far a digit travels, as a share of its cell — the web keyframes use 0.9em. */
const TRAVEL = 0.9;

interface Roll {
  /** What is on screen now. */
  shown: string;
  /** What it replaced, kept only while the outgoing digits are still moving. */
  leaving: string | null;
}

/**
 * A formatted figure whose digits roll over when it changes — but only when the
 * change came from the user's own trade write (see `lib/rolling-numbers`).
 * Mounting, a cold start, or re-scoping a filter swaps the text with no motion,
 * so a screen never appears to count itself up on arrival.
 *
 * The value arrives already formatted, currency and separators included, and is
 * animated per character, so this never has to know about locales or money.
 *
 * The two halves of the roll are driven by one shared progress value rather
 * than reanimated's `entering`/`exiting`: a layout animation is read off the
 * props the removed element last rendered with, and the character leaving was
 * rendered before anyone knew it was about to leave, so its `exiting` would
 * always have been undefined and only half the roll would play.
 *
 * `cellHeight` has to be given because each character is clipped to its own box
 * — that clip is what makes a digit roll rather than fly across its neighbours
 * — and RN has no way to ask a `Text` how tall its line will be. Pass a little
 * more than the font size.
 */
export function RollingNumber({
  value,
  style,
  cellHeight,
}: {
  value: string;
  style?: StyleProp<TextStyle>;
  cellHeight: number;
}) {
  const [roll, setRoll] = useState<Roll>({ shown: value, leaving: null });
  const [seen, setSeen] = useState(value);
  const progress = useSharedValue(1);

  // Adjusting state during render — React's sanctioned answer to "derive state
  // from a changed prop", and why this isn't an effect: an effect would repaint
  // the new figure first and start the roll a frame later, from the value it
  // was already showing.
  if (value !== seen) {
    setSeen(value);
    setRoll((current) =>
      current.shown === value
        ? current
        : { shown: value, leaving: isRollArmed() ? current.shown : null },
    );
  }

  useEffect(() => {
    if (roll.leaving == null) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: ROLL_MS });
    const timer = setTimeout(() => setRoll((current) => ({ ...current, leaving: null })), ROLL_MS);
    return () => clearTimeout(timer);
  }, [roll.leaving, progress]);

  const travel = cellHeight * TRAVEL;
  const arriving = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * travel }],
  }));
  const departing = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: -progress.value * travel }],
  }));

  const chars = Array.from(roll.shown);
  const leaving = roll.leaving == null ? null : Array.from(roll.leaving);
  // Right-aligned comparison: a figure that gains a digit ("$9.99" → "$10.99")
  // shifts every character left, and index-for-index it would look like every
  // one of them changed. Counting from the units end keeps a digit paired with
  // the digit it actually replaced.
  const offset = leaving ? leaving.length - chars.length : 0;

  return (
    // Grouped for VoiceOver: one figure read as one phrase, not a character at a
    // time — the per-character cells are a rendering detail.
    <View style={styles.row} accessible accessibilityLabel={roll.shown}>
      {chars.map((char, index) => {
        const before = leaving?.[index + offset];
        const changed = before != null && before !== char;
        return (
          <View key={index} style={[styles.cell, changed && { height: cellHeight }]}>
            {changed ? (
              <Animated.Text style={[style, styles.departing, departing]}>{before}</Animated.Text>
            ) : null}
            <Animated.Text style={[style, changed && arriving]}>{char}</Animated.Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = {
  row: { flexDirection: 'row' },
  // The clip is the whole effect: a digit leaves through the top of its own box
  // instead of over the line above it. Only a rolling cell needs it — a fixed
  // height on every cell would clip descenders the rest of the time.
  cell: { overflow: 'hidden', justifyContent: 'center' },
  // Both characters share the cell so one can rise as the other departs.
  departing: { position: 'absolute' },
} as const;
