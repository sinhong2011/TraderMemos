import { type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import type { ColorValue } from 'react-native';

import { Icon } from '@/components/icon';
import Reanimated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

/** Same spring the tab strips and floating search ride — one motion vocabulary. */
const SWAP_SPRING = { duration: 420, dampingRatio: 0.85 } as const;

const fill = { position: 'absolute', top: 0, left: 0 } as const;

/**
 * SF Symbol that swaps glyphs with the system `.replace` feel — the leaving
 * one scales down and quarter-turns away while the arriving one unwinds in.
 * expo-symbols only exposes looping effects (bounce/pulse), not UIKit's
 * `setSymbolImage` content transition, so the replace is rebuilt in Reanimated.
 *
 * Both glyphs stay mounted in fixed slots and only the shared progress moves,
 * so a swap interrupted mid-flight reverses smoothly instead of jump-cutting.
 */
export function AnimatedSymbolSwap({
  name,
  size,
  tintColor,
}: {
  name: SFSymbol;
  size: number;
  tintColor: ColorValue;
}) {
  // The incoming name lands in the hidden slot during render, so the spring's
  // first frame already draws it; `showB` names the slot that owns `name`.
  const [slots, setSlots] = useState({ a: name, b: name, showB: false });
  const current = slots.showB ? slots.b : slots.a;
  if (name !== current) {
    setSlots(
      slots.showB ? { a: name, b: slots.b, showB: false } : { a: slots.a, b: name, showB: true },
    );
  }

  const progress = useSharedValue(slots.showB ? 1 : 0);
  useEffect(() => {
    progress.value = withSpring(slots.showB ? 1 : 0, SWAP_SPRING);
  }, [slots.showB, progress]);

  const slotAStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 0.4]) },
      { rotate: `${interpolate(progress.value, [0, 1], [0, -90])}deg` },
    ],
  }));
  const slotBStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.4, 1]) },
      { rotate: `${interpolate(progress.value, [0, 1], [90, 0])}deg` },
    ],
  }));

  return (
    <Reanimated.View style={{ width: size, height: size }}>
      <Reanimated.View style={[fill, slotAStyle]}>
        <Icon name={slots.a} size={size} tintColor={tintColor} />
      </Reanimated.View>
      <Reanimated.View style={[fill, slotBStyle]}>
        <Icon name={slots.b} size={size} tintColor={tintColor} />
      </Reanimated.View>
    </Reanimated.View>
  );
}
