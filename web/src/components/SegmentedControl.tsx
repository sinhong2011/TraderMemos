import { motion, useReducedMotion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./ui/button";
import { ButtonGroup } from "./ui/button-group";

export interface SegmentOption {
  value: string;
  label: ReactNode;
}

type SegmentTone = "pos" | "neg";

const INDICATOR_TONE: Record<SegmentTone, string> = {
  pos: "bg-profit/15 shadow-sm",
  neg: "bg-destructive/15 shadow-sm",
};

const ACTIVE_TEXT: Record<SegmentTone, string> = {
  pos: "text-profit",
  neg: "text-destructive",
};

const SIZE_MAP = {
  xs: "xs",
  sm: "sm",
  md: "lg",
} as const;

const SIZE_CLASS = {
  xs: "h-6 px-2 text-[11px] font-medium",
  sm: "h-7 px-2.5 text-[12px] font-medium",
  md: "h-9 px-3.5 text-[13px] font-semibold",
} as const;

const PILL_SPRING = {
  type: "spring" as const,
  stiffness: 520,
  damping: 38,
  mass: 0.75,
};

/**
 * Compact exclusive options — ReUI ButtonGroup with a soft pill track
 * and a Motion-sliding active indicator.
 * @see https://reui.io/r/base-nova/c-button-group-42.json
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
    <ButtonGroup
      aria-label={ariaLabel}
      className={cn(
        // Soft track — undo joined-outline chrome for a pill segmented look
        "gap-0.5 rounded-lg border border-border bg-muted p-0.5 shadow-xs",
        "*:data-slot:rounded-md!",
        "[&>[data-slot]~[data-slot]]:rounded-md!",
        "[&>[data-slot]~[data-slot]]:border-l!",
        "[&>[data-slot]:not(:has(~[data-slot]))]:rounded-md!",
        fullWidth && "w-full",
        className,
      )}
    >
      {options.map((o) => {
        const active = value === o.value;
        const tone = tones?.[o.value];
        return (
          <Button
            key={o.value}
            type="button"
            variant="ghost"
            size={SIZE_MAP[size]}
            aria-pressed={active}
            className={cn(
              SIZE_CLASS[size],
              "relative isolate border-transparent shadow-none",
              "text-muted-foreground hover:bg-transparent hover:text-foreground",
              "focus-visible:outline-offset-0",
              "active:scale-[0.98] motion-reduce:active:scale-100",
              fullWidth && "min-w-0 flex-1",
              active && (tone ? ACTIVE_TEXT[tone] : "text-foreground"),
            )}
            onClick={() => onChange(o.value)}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                className={cn(
                  "absolute inset-0 -z-10 rounded-md",
                  activeTone
                    ? INDICATOR_TONE[activeTone]
                    : // Light: raised white on muted. Dark: `background` is the void (near-black) —
                      // use `input` (translucent white) so the pill lifts like ReUI/shadcn demos.
                      "bg-background shadow-sm dark:bg-input dark:shadow-none",
                )}
                transition={reduceMotion ? { duration: 0 } : PILL_SPRING}
              />
            ) : null}
            <span className="relative z-0">{o.label}</span>
          </Button>
        );
      })}
    </ButtonGroup>
  );
}
