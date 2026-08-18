import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const DEFAULT_SEGMENTS = 48;
/** Tick pitch the comb aims for; below ~16px it reads as noise, above ~32px as a slab. */
const TICK_TARGET_PX = 24;
const MIN_SEGMENTS = 12;
const MAX_SEGMENTS = 120;

/** How far the first tick leans toward white — the pale end of the ramp. */
const LIGHTEN_START = 0.55;
/** How far past-goal ticks lean toward black at the very end — the deepest hue. */
const DEEPEN_END = 0.22;

export type GoalProgressTone = "profit" | "warning";

const TONE_VAR: Record<GoalProgressTone, string> = {
  profit: "var(--color-profit)",
  warning: "var(--color-warning)",
};

export interface GoalProgressBarProps {
  /** Ratio against the goal: 1 = met, >1 overshoot, <0 losing. */
  progress: number;
  /** Hue for the 0–100% run (the pace state may warm it); losses go `loss` red. */
  tone?: GoalProgressTone;
  /** Fixed tick count. Omit to derive one from the rendered width. */
  segments?: number;
  className?: string;
  trackClassName?: string;
  "aria-label"?: string;
}

/**
 * Segmented tick progress bar — the energy-bar comb shared with mobile's
 * `GoalTicks`, with the fill drawn as one continuous ramp: pale at the first
 * tick, deepening tick by tick as the run accumulates. Intensity is the
 * meaning — the further along the bar, the deeper the color.
 *
 * Two states beyond the plain 0–100% run:
 * - **Overshoot** (`progress > 1`): the scale grows to the total, a goal-line
 *   gap marks 100%, and the ramp keeps deepening past it — the tail beyond
 *   the goal is the deepest hue on the bar.
 * - **Loss** (`progress < 0`): the same ramp in the loss red, filling for the
 *   drawdown measured against the goal.
 *
 * The tick count follows the rendered width: a fixed count turns into fat
 * slabs on a wide card (48 ticks across 1800px is a 36px-per-tick grey band).
 */
export function GoalProgressBar({
  progress,
  tone = "profit",
  segments,
  className,
  // `bg-muted` is white/black at 4%, which vanishes against `bg-card` — an empty
  // bar then reads as a hole in the card rather than a track.
  trackClassName = "bg-muted-foreground/20",
  "aria-label": ariaLabel = "Goal progress",
}: GoalProgressBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(DEFAULT_SEGMENTS);

  useEffect(() => {
    const el = ref.current;
    if (!el || segments != null) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width <= 0) return;
      const ticks = Math.round(width / TICK_TARGET_PX);
      setMeasured(Math.min(MAX_SEGMENTS, Math.max(MIN_SEGMENTS, ticks)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [segments]);

  const count = segments ?? measured;
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
  const pct = Math.round(Math.max(0, progress) * 100);

  const base = losing ? "var(--color-loss)" : TONE_VAR[tone];

  /**
   * Ramp position → color. 0..goalTick runs pale→pure; past the goal the same
   * ramp continues pure→deep, so the ordering never inverts.
   */
  const tickColor = (i: number): string => {
    if (i < goalTick) {
      const t = goalTick <= 1 ? 1 : i / (goalTick - 1);
      const white = LIGHTEN_START * (1 - t) * 100;
      return `color-mix(in srgb, ${base}, #fff ${white.toFixed(1)}%)`;
    }
    const tailLength = count - goalTick;
    const t = tailLength <= 1 ? 1 : (i - goalTick) / (tailLength - 1);
    const black = DEEPEN_END * t * 100;
    return `color-mix(in srgb, ${base}, #000 ${black.toFixed(1)}%)`;
  };

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      // shrink-0: the bar has no intrinsic content, so inside a squeezed column
      // flex parent it is the first thing to collapse to 0px.
      className={cn("flex h-5 w-full shrink-0 items-center gap-px", className)}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-full min-w-0 flex-1 rounded-[1px] transition-colors duration-300 motion-reduce:transition-none",
            // Capsule caps on the comb's outer corners.
            i === 0 && "rounded-s-full",
            i === count - 1 && "rounded-e-full",
            trackClassName,
            // The goal line: a thermometer's target mark where the run
            // beyond the goal begins.
            over && i === goalTick && "ms-0.5",
          )}
          // The ramp mixes live theme tokens per tick, so it rides `style`.
          style={i < filled ? { backgroundColor: tickColor(i) } : undefined}
        />
      ))}
    </div>
  );
}
