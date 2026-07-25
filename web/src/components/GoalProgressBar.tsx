import { cn } from "@/lib/cn";

const DEFAULT_SEGMENTS = 48;

export interface GoalProgressBarProps {
  /** 0–1+ progress ratio (values > 1 fill the bar fully). */
  progress: number;
  segments?: number;
  className?: string;
  /** Filled segment color class. Default profit green. */
  fillClassName?: string;
  trackClassName?: string;
  "aria-label"?: string;
}

/**
 * Segmented tick progress bar — filled ticks for progress, muted for remaining.
 */
export function GoalProgressBar({
  progress,
  segments = DEFAULT_SEGMENTS,
  className,
  fillClassName = "bg-profit",
  trackClassName = "bg-muted",
  "aria-label": ariaLabel = "Goal progress",
}: GoalProgressBarProps) {
  const filled = Math.min(segments, Math.max(0, Math.round(Math.min(progress, 1) * segments)));
  const pct = Math.round(Math.max(0, progress) * 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={cn("flex h-5 w-full items-center gap-px", className)}
    >
      {Array.from({ length: segments }, (_, i) => (
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
