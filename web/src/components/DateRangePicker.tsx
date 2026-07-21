import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";
import { formatRangeLabel } from "../lib/dateRangePresets";
import { useFilters } from "../lib/filters";
import { cn } from "../lib/cn";
import { DateRangePanel } from "./DateRangePanel";
import { SignalPopover } from "./SignalPopover";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function DateRangePicker({
  variant = "header",
  side,
}: {
  variant?: "header" | "rail";
  /** Popover side; defaults to `right` for rail, `bottom` for header. */
  side?: "top" | "right" | "bottom" | "left";
}) {
  const { from, to } = useFilters();
  const [open, setOpen] = useState(false);
  const label = formatRangeLabel(from, to);
  const filterActive = Boolean(from || to);
  const popoverSide = side ?? (variant === "rail" ? "right" : "bottom");
  const tipSide = popoverSide === "right" ? "right" : "bottom";

  if (variant === "rail") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                aria-label="Date range"
                className={cn(
                  "group relative flex size-8 cursor-pointer items-center justify-center rounded-control outline-none",
                  "pointer-coarse:size-11",
                  "transition-[background-color,color,transform] duration-150 ease-out",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  "motion-reduce:transition-none",
                  open || filterActive
                    ? "bg-bg-hover text-text"
                    : "text-text-dim hover:bg-bg-hover hover:text-text",
                )}
              />
            }
          >
            <CalendarDays
              size={15}
              strokeWidth={1.75}
              className="transition-transform duration-150 ease-out group-hover:scale-105 motion-reduce:transition-none"
            />
          </TooltipTrigger>
          <TooltipContent side={tipSide}>{label}</TooltipContent>
        </Tooltip>
        <PopoverContent
          side={popoverSide}
          align="end"
          sideOffset={popoverSide === "right" ? 8 : 6}
          className="w-auto overflow-hidden border-border bg-bg-panel p-0 shadow-[0_12px_32px_rgba(18,18,24,0.55)]"
        >
          <DateRangePanel onApplied={() => setOpen(false)} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <SignalPopover
      open={open}
      onOpenChange={setOpen}
      align="end"
      triggerAriaLabel="Date range"
      className="overflow-hidden p-0"
      triggerClassName={cn(
        "h-8 min-w-[112px] rounded-control border border-transparent bg-transparent px-2.5 pointer-coarse:h-11",
        "text-left transition-[background-color] duration-150",
        "hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        open && "bg-bg-hover",
      )}
      trigger={
        <>
          <CalendarDays
            size={13}
            strokeWidth={1.75}
            className="shrink-0 text-text-dim"
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-text-muted">
            {label}
          </span>
          <ChevronDown
            size={12}
            strokeWidth={1.75}
            className={cn(
              "shrink-0 text-text-dim transition-transform duration-150",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </>
      }
    >
      <DateRangePanel onApplied={() => setOpen(false)} />
    </SignalPopover>
  );
}
