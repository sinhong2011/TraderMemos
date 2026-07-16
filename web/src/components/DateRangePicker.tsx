import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";
import { formatRangeLabel } from "../lib/dateRangePresets";
import { useFilters } from "../lib/filters";
import { cn } from "../lib/cn";
import { DateRangePanel } from "./DateRangePanel";
import { SignalPopover } from "./SignalPopover";

export function DateRangePicker() {
  const { from, to } = useFilters();
  const [open, setOpen] = useState(false);
  const label = formatRangeLabel(from, to);

  return (
    <SignalPopover
      open={open}
      onOpenChange={setOpen}
      align="end"
      triggerAriaLabel="Date range"
      className="overflow-hidden p-0"
      triggerClassName={cn(
        "h-8 min-w-[112px] rounded-control border-none bg-bg-input px-2.5",
        "text-left transition-[background-color] duration-150",
        "hover:bg-bg-input-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        open && "bg-bg-input-hover",
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
