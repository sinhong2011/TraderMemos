import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./ui/button";

/**
 * Period stepper — prev / label / next fused into one `bg-muted` track so the
 * calendar toolbar reads as a single object and stays on one row on mobile.
 * Track height matches `SegmentedControl` size `sm` so toolbar controls align.
 *
 * Chevrons stay visually small; their coarse-pointer hit area comes from the
 * Button `::after` target in `buttonVariants`.
 */
export function PeriodNav({
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  canGoPrev = true,
  canGoNext = true,
  className,
  children,
}: {
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  className?: string;
  /** Middle slot — the period label or its picker trigger. */
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-8 min-w-0 items-center gap-0.5 rounded-lg bg-muted p-0.5 sm:h-7",
        "dark:bg-input/32",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onPrev}
        disabled={!canGoPrev}
        aria-label={prevLabel}
        className="h-full w-6 rounded-md text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={14} strokeWidth={1.75} />
      </Button>

      {children}

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label={nextLabel}
        className="h-full w-6 rounded-md text-muted-foreground hover:text-foreground"
      >
        <ChevronRight size={14} strokeWidth={1.75} />
      </Button>
    </div>
  );
}
