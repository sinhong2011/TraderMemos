import { useState } from 'react';
import { cn } from 'panelui-native';
import { View, type LayoutChangeEvent } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { usePnlPalette } from '@/styles/pnl';

/** Tick pitch the comb aims for; below ~12pt it reads as noise, above ~24 as a slab. */
const TICK_TARGET_PT = 16;
const MIN_SEGMENTS = 12;
const MAX_SEGMENTS = 60;
const DEFAULT_SEGMENTS = 24;

/** How far the first tick leans toward white — the 淺綠 end of the ramp. */
const LIGHTEN_START = 0.55;
/** How far past-goal ticks lean toward black at the very end — the deepest green. */
const DEEPEN_END = 0.22;

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

function toCss({ r, g, b }: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Segmented tick progress bar — the web `GoalProgressBar` energy-bar comb,
 * with the fill drawn as one continuous ramp: pale at the first tick,
 * deepening tick by tick as the run accumulates. Intensity is the meaning —
 * the further along the bar, the deeper the color.
 *
 * Two states the web leaves to text:
 * - **Overshoot** (`progress > 1`): the scale grows to the total, a goal-line
 *   gap marks 100%, and the ramp keeps deepening past it — the tail beyond
 *   the goal is the deepest green on the bar.
 * - **Loss** (`progress < 0`): the same ramp in the loss red, filling for the
 *   drawdown measured against the goal.
 *
 * The tick count follows the rendered width, as on web: a fixed count turns
 * into fat slabs on an iPad card.
 */
export function GoalTicks({
  progress,
  tone = 'profit',
  accessibilityLabel,
}: {
  /** Ratio against the goal: 1 = met, >1 overshoot, <0 losing. */
  progress: number;
  /** Hue for the 0–100% run; the pace state may warm it to `warning`. */
  tone?: 'profit' | 'warning';
  accessibilityLabel?: string;
}) {
  const palette = usePnlPalette();
  const [warning] = useCSSVariable(['--color-warning']) as [string];
  const [count, setCount] = useState(DEFAULT_SEGMENTS);
  const onLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width <= 0) return;
    const ticks = Math.round(width / TICK_TARGET_PT);
    setCount(Math.min(MAX_SEGMENTS, Math.max(MIN_SEGMENTS, ticks)));
  };

  const losing = progress < 0;
  const over = progress > 1;
  // Past the goal the scale grows to the total, so the bar reads left to
  // right: the goal line sits where 100% falls on the widened scale.
  const goalTick = over ? Math.max(1, Math.round((1 / progress) * count)) : count;
  const filled = losing
    ? Math.round(Math.min(1, -progress) * count)
    : over
      ? count
      : Math.round(Math.min(1, Math.max(0, progress)) * count);

  const baseHex = losing ? palette.loss : tone === 'warning' ? warning : palette.profit;
  const base = hexToRgb(baseHex);

  /**
   * Ramp position → color. 0..goalTick runs pale→pure; past the goal the same
   * ramp continues pure→deep, so the ordering never inverts.
   */
  const tickColor = (i: number): string => {
    if (i < goalTick) {
      const t = goalTick <= 1 ? 1 : i / (goalTick - 1);
      return toCss(mix(mix(base, WHITE, LIGHTEN_START), base, t));
    }
    const tailLength = count - goalTick;
    const t = tailLength <= 1 ? 1 : (i - goalTick) / (tailLength - 1);
    return toCss(mix(base, BLACK, DEEPEN_END * t));
  };

  return (
    <View
      onLayout={onLayout}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.max(0, progress) * 100) }}
      className="h-4 w-full shrink-0 flex-row items-center gap-[1px]"
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          className={cn(
            'h-full min-w-0 flex-1 rounded-[1px]',
            // Capsule caps on the comb's outer corners.
            i === 0 && 'rounded-s-full',
            i === count - 1 && 'rounded-e-full',
            // `bg-muted` is white/black at 4%, which vanishes against the card —
            // an empty track then reads as a hole rather than a scale.
            'bg-muted-foreground/20',
            // The goal line: a thermometer's target mark where the run
            // beyond the goal begins.
            over && i === goalTick && 'ms-[2px]',
          )}
          // The ramp is computed from live palette hexes, so it rides `style`.
          style={i < filled ? { backgroundColor: tickColor(i) } : undefined}
        />
      ))}
    </View>
  );
}
