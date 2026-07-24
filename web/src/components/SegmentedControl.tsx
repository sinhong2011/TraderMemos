import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "./Tabs";

export interface SegmentOption {
  value: string;
  label: ReactNode;
}

type SegmentTone = "pos" | "neg";

const INDICATOR_TONE: Record<SegmentTone, string> = {
  pos: "bg-profit/20",
  neg: "bg-destructive/20",
};

const TRIGGER_TONE: Record<SegmentTone, string> = {
  pos: "data-active:text-profit",
  neg: "data-active:text-destructive",
};

/**
 * Compact segmented options — Tabs primitive with the muted pill chrome.
 * For panels / other tab UIs, compose `Tabs*` directly.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  /** Stretch equal-width segments across the container (section tabs). */
  fullWidth = false,
  size = "sm",
  /** Optional semantic fill for the active pill (e.g. long→pos, short→neg). */
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
  const tall = size === "md";
  const tiny = size === "xs";
  const activeTone = tones?.[value];
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") onChange(next);
      }}
      className={cn(fullWidth && "w-full")}
    >
      <TabsList
        aria-label={ariaLabel}
        fullWidth={fullWidth}
        className={cn(
          tiny ? "h-8" : "h-10",
          "rounded-md border border-border bg-muted p-1",
          className,
        )}
      >
        <TabsIndicator
          className={cn(
            "rounded-md transition-[left,top,width,height,background-color] duration-250 ease-[cubic-bezier(0.16, 1, 0.3, 1)]",
            activeTone ? INDICATOR_TONE[activeTone] : "bg-accent",
          )}
        />
        {options.map((o) => {
          const tone = tones?.[o.value];
          return (
            <TabsTrigger
              key={o.value}
              value={o.value}
              fullWidth={fullWidth}
              className={cn(
                "h-full font-medium text-muted-foreground hover:text-muted-foreground",
                tone ? TRIGGER_TONE[tone] : "data-active:text-foreground",
                tall ? "px-3.5 text-[13px]" : tiny ? "px-2 text-[11px]" : "px-3 text-[12px]",
              )}
            >
              {o.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
