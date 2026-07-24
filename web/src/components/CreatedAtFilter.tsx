import { CalendarDays, XCircle } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { formatRangeLabel } from "../lib/dateRangePresets";
import { cn } from "../lib/cn";
import { useFilters } from "../lib/filters";
import { DateRangePanel } from "./DateRangePanel";
import { buttonVariants } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/**
 * tablecn-style date range filter — dashed outline trigger + calendar popover.
 * Shares `from`/`to` with the header date range via the filter store.
 */
export function CreatedAtFilter({ className }: { className?: string }) {
  const { from, to, setRange } = useFilters();
  const [open, setOpen] = useState(false);
  const active = !!(from || to);
  const label = formatRangeLabel(from, to);

  function clear(e?: MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    setRange(undefined, undefined);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-8 border-border !bg-transparent font-normal hover:!bg-transparent aria-expanded:!bg-transparent",
          className,
        )}
      >
        {active ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear Created At filter"
            onClick={clear}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                setRange(undefined, undefined);
              }
            }}
            className="inline-flex text-muted-foreground transition-opacity hover:text-foreground"
          >
            <XCircle size={14} strokeWidth={1.75} />
          </span>
        ) : (
          <CalendarDays
            size={14}
            strokeWidth={1.75}
            className="text-muted-foreground"
            aria-hidden
          />
        )}
        <span>Created At</span>
        {active ? (
          <>
            <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />
            <span className="hidden max-w-[9rem] truncate rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
              {label}
            </span>
            <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground sm:hidden">
              1
            </span>
          </>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto overflow-hidden p-0 shadow-[0_16px_40px_rgba(18,18,24,0.65)]"
      >
        <DateRangePanel onApplied={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
