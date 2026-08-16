import { useState } from 'react';
import { cn } from 'panelui-native';
import { View, type LayoutChangeEvent } from 'react-native';

/** Tick pitch the comb aims for; below ~12pt it reads as noise, above ~24 as a slab. */
const TICK_TARGET_PT = 16;
const MIN_SEGMENTS = 12;
const MAX_SEGMENTS = 60;
const DEFAULT_SEGMENTS = 24;

/**
 * Segmented tick progress bar — the web `GoalProgressBar` energy-bar comb,
 * with two states the web leaves to text:
 *
 * - **Overshoot** (`progress > 1`): the bar is a game energy bar, so the run
 *   past the goal is a second lap — gold ticks refill from the left over the
 *   full green base. 124% reads as a full bar plus 24% of gold.
 * - **Loss** (`progress < 0`): red ticks fill from the left for the drawdown
 *   measured against the goal, instead of an empty track that says nothing.
 *
 * The tick count follows the rendered width, as on web: a fixed count turns
 * into fat slabs on an iPad card.
 */
export function GoalTicks({
  progress,
  fillClassName = 'bg-profit',
  accessibilityLabel,
}: {
  /** Ratio against the goal: 1 = met, >1 overshoot, <0 losing. */
  progress: number;
  /** Base fill for the 0–100% run (the pace state may swap it to warning). */
  fillClassName?: string;
  accessibilityLabel?: string;
}) {
  const [count, setCount] = useState(DEFAULT_SEGMENTS);
  const onLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width <= 0) return;
    const ticks = Math.round(width / TICK_TARGET_PT);
    setCount(Math.min(MAX_SEGMENTS, Math.max(MIN_SEGMENTS, ticks)));
  };

  const losing = progress < 0;
  const base = Math.min(1, Math.max(0, progress));
  const filled = Math.round(base * count);
  // Second lap caps at another 100% — past 200% the copy carries the number.
  const overshoot = Math.round(Math.min(1, Math.max(0, progress - 1)) * count);
  const lossFilled = Math.round(Math.min(1, -Math.min(0, progress)) * count);

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
            // `bg-muted` is white/black at 4%, which vanishes against the card —
            // an empty track then reads as a hole rather than a scale.
            'bg-muted-foreground/20',
            losing ? i < lossFilled && 'bg-loss' : i < filled && fillClassName,
            // The gold lap sits over the green base — `heading` is the app's
            // celebratory accent (amber in dark, deep teal in light), distinct
            // from the profit green it covers.
            !losing && i < overshoot && 'bg-heading',
          )}
        />
      ))}
    </View>
  );
}
