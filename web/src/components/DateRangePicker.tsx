import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";
import { formatRangeLabel } from "@/lib/dateRangePresets";
import { useFilters } from "@/lib/filters";
import { cn } from "@/lib/cn";
import { filterChipClass } from "./field-styles";
import { DateRangePanel } from "./DateRangePanel";
import { ControlledPopover } from "./ControlledPopover";
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
                  "group relative flex size-8 cursor-pointer items-center justify-center rounded-md outline-none",
                  "pointer-coarse:size-11",
                  "transition-[background-color,color,transform] duration-150 ease-out",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  "motion-reduce:transition-none",
                  open || filterActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
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
          className="w-auto overflow-hidden p-0"
        >
          <DateRangePanel onApplied={() => setOpen(false)} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <ControlledPopover
      open={open}
      onOpenChange={setOpen}
      align="end"
      triggerAriaLabel="Date range"
      className="overflow-hidden p-0"
      triggerClassName={cn(
        filterChipClass,
        "min-w-[7rem] flex-1 text-left",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        open && "bg-accent",
      )}
      trigger={
        <>
          <CalendarDays
            size={14}
            strokeWidth={1.75}
            className="shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <ChevronDown
            size={12}
            strokeWidth={1.75}
            className={cn(
              "shrink-0 text-muted-foreground transition-transform duration-150",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </>
      }
    >
      <DateRangePanel onApplied={() => setOpen(false)} />
    </ControlledPopover>
  );
}
