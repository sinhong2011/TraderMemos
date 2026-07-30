import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const DEFAULT_SEGMENTS = 48;
/** Tick pitch the comb aims for; below ~16px it reads as noise, above ~32px as a slab. */
const TICK_TARGET_PX = 24;
const MIN_SEGMENTS = 12;
const MAX_SEGMENTS = 120;

export interface GoalProgressBarProps {
  /** 0–1+ progress ratio (values > 1 fill the bar fully). */
  progress: number;
  /** Fixed tick count. Omit to derive one from the rendered width. */
  segments?: number;
  className?: string;
  /** Filled segment color class. Default profit green. */
  fillClassName?: string;
  trackClassName?: string;
  "aria-label"?: string;
}

/**
 * Segmented tick progress bar — filled ticks for progress, muted for remaining.
 *
 * The tick count follows the rendered width: a fixed count turns into fat slabs
 * on a wide card (48 ticks across 1800px is a 36px-per-tick grey band).
 */
export function GoalProgressBar({
  progress,
  segments,
  className,
  fillClassName = "bg-profit",
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
  const filled = Math.min(count, Math.max(0, Math.round(Math.min(progress, 1) * count)));
  const pct = Math.round(Math.max(0, progress) * 100);

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
            i < filled ? fillClassName : trackClassName,
          )}
        />
      ))}
    </div>
  );
}
