import { cn } from "../lib/cn";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "./Tabs";

export interface SegmentOption {
  value: string;
  label: string;
}

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
}: {
  options: SegmentOption[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  className?: string;
  fullWidth?: boolean;
  size?: "sm" | "md";
}) {
  const tall = size === "md";
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
        className={cn("h-10 rounded-control border-none bg-bg-input p-1", className)}
      >
        <TabsIndicator className="rounded-control bg-bg-input-hover" />
        {options.map((o) => (
          <TabsTrigger
            key={o.value}
            value={o.value}
            fullWidth={fullWidth}
            className={cn(
              "h-full font-medium text-text-dim hover:text-text-muted data-active:text-text",
              tall ? "px-3.5 text-[13px]" : "px-3 text-[12px]",
            )}
          >
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
