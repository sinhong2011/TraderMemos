"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, type ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/cn";

export interface SegmentOption {
  value: string;
  label: ReactNode;
}

type SegmentTone = "pos" | "neg";

const INDICATOR_TONE: Record<SegmentTone, string> = {
  pos: "bg-profit/15 shadow-xs/5",
  neg: "bg-destructive/15 shadow-xs/5",
};

const ACTIVE_TEXT: Record<SegmentTone, string> = {
  pos: "text-profit",
  neg: "text-destructive",
};

/** Map product sizes onto coss ToggleGroup sizes. */
const TOGGLE_SIZE = {
  xs: "sm",
  sm: "sm",
  md: "default",
} as const;

/** Outer track height — `md` matches coss Input / NativeSelect (`h-8.5` / `sm:h-7.5`). */
const TRACK_SIZE = {
  xs: "h-6 p-px",
  sm: "h-7.5 p-0.5 sm:h-7",
  md: "h-8.5 p-0.5 sm:h-7.5",
} as const;

/** Items fill the track; override Toggle `h-*` / `min-w-*` so padding doesn't inflate height. */
const SIZE_CLASS = {
  xs: "h-full min-h-0 min-w-0 px-2 text-[11px] font-medium sm:h-full sm:min-w-0",
  sm: "h-full min-h-0 min-w-0 px-2.5 text-[12px] font-medium sm:h-full sm:min-w-0",
  md: "h-full min-h-0 min-w-0 px-3 text-[12px] font-semibold sm:h-full sm:min-w-0",
} as const;

const PILL_SPRING = {
  type: "spring" as const,
  stiffness: 520,
  damping: 38,
  mass: 0.75,
};

/**
 * Exclusive segmented control — coss ToggleGroup track + Motion sliding pill.
 * @see https://coss.com/ui/docs/components/toggle-group
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  /** Stretch equal-width segments across the container. */
  fullWidth = false,
  size = "sm",
  /** Optional semantic fill for the active segment (e.g. long→pos, short→neg). */
  tones,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  className?: string;
  fullWidth?: boolean;
  /** "xs" is a tighter variant for cramped mobile toolbars. */
  size?: "xs" | "sm" | "md";
  tones?: Partial<Record<string, SegmentTone>>;
}) {
  const layoutId = `segmented-pill-${useId()}`;
  const reduceMotion = useReducedMotion();
  const activeTone = tones?.[value];

  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(next) => {
        // Exclusive control — ignore deselection of the active item.
        const nextValue = next[0];
        if (!nextValue || nextValue === value) return;
        onChange(nextValue);
      }}
      size={TOGGLE_SIZE[size]}
      variant="default"
      aria-label={ariaLabel}
      className={cn(
        "items-stretch gap-0.5 rounded-lg border border-input bg-muted shadow-xs/5",
        "dark:bg-input/32",
        TRACK_SIZE[size],
        fullWidth && "w-full",
        className,
      )}
    >
      {options.map((o) => {
        const active = value === o.value;
        const tone = tones?.[o.value];
        return (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            aria-label={typeof o.label === "string" ? o.label : undefined}
            className={cn(
              SIZE_CLASS[size],
              "relative isolate border-transparent shadow-none before:hidden",
              "text-muted-foreground hover:bg-transparent hover:text-foreground",
              "data-pressed:bg-transparent data-pressed:text-foreground",
              "focus-visible:ring-offset-0",
              "active:scale-[0.98] motion-reduce:active:scale-100",
              fullWidth && "min-w-0 flex-1",
              active && (tone ? ACTIVE_TEXT[tone] : "text-foreground"),
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                className={cn(
                  "absolute inset-0 -z-10 rounded-md",
                  activeTone
                    ? INDICATOR_TONE[activeTone]
                    : // Light: raised surface on muted. Dark: lift with translucent input fill.
                      "bg-background shadow-xs/5 dark:bg-input dark:shadow-none",
                )}
                transition={reduceMotion ? { duration: 0 } : PILL_SPRING}
              />
            ) : null}
            <span className="relative z-0">{o.label}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
