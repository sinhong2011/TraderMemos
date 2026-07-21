import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { intlLocale } from "../lib/locale";
import { SignalPopover } from "./SignalPopover";
import { Button } from "./ui/button";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";

/** Sidebar shortcut styled like the DateRangePanel presets. */
function QuickJump({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn(
        "relative h-auto w-full justify-start rounded-control py-2 pr-2 pl-2.5 text-left text-[11px]",
        "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
        active ? "bg-bg-hover text-text" : "text-text-muted",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent"
        />
      )}
      {children}
    </Button>
  );
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString(intlLocale(), {
    month: "long",
    year: "numeric",
  });
}

function monthLabels(kind: "short" | "long"): string[] {
  const locale = intlLocale();
  return Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString(locale, { month: kind }),
  );
}

export function MonthPicker({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  onToday,
  onJumpToMonth,
  canGoNext = true,
}: {
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onJumpToMonth: (year: number, month: number) => void;
  canGoNext?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const now = new Date();

  useEffect(() => {
    if (open) setPickerYear(year);
  }, [open, year]);

  const monthLabel = formatMonthYear(new Date(year, month - 1, 1));
  const shortMonths = monthLabels("short");
  const longMonths = monthLabels("long");

  const maxYear = now.getFullYear();
  const minYear = Math.min(maxYear - 10, pickerYear, year);
  const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, i) => {
    const y = maxYear - i;
    return { value: String(y), label: String(y) };
  });

  const isThisMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const isLastMonth = year === lastMonth.getFullYear() && month === lastMonth.getMonth() + 1;

  function jump(y: number, m: number) {
    onJumpToMonth(y, m);
    setOpen(false);
  }

  function applyQuick(offsetMonths: number) {
    const d = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
    jump(d.getFullYear(), d.getMonth() + 1);
  }

  return (
    <div className="flex items-center gap-1 md:gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onPrevMonth}
        aria-label="Previous month"
        className="pointer-coarse:size-11"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
      </Button>

      <SignalPopover
        open={open}
        onOpenChange={setOpen}
        align="start"
        triggerAriaLabel={`${monthLabel}, choose month`}
        className="overflow-hidden p-0"
        triggerClassName={cn(
          "h-8 min-w-[6.5rem] rounded-control border-none bg-bg-input px-2.5 md:h-7 md:min-w-[9.5rem]",
          "max-md:pointer-coarse:h-8 md:pointer-coarse:h-11",
          "text-[11px] font-semibold tabular-nums text-text md:text-[13px]",
          "transition-[background-color] duration-150",
          "hover:bg-bg-input-hover",
          open && "bg-bg-input-hover",
        )}
        trigger={
          <>
            <span className="min-w-0 flex-1 truncate text-center">{monthLabel}</span>
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
        <div className="flex w-[320px] max-w-[calc(100vw-2rem)]" aria-label="Choose month">
          <aside className="flex w-[116px] shrink-0 flex-col bg-bg">
            <p className="m-0 px-3 pt-3 pb-2 text-[11px] font-medium uppercase tracking-widest text-text-muted">
              Quick jump
            </p>
            <div className="flex flex-col gap-0.5 px-2 pb-3">
              <QuickJump
                active={isThisMonth}
                onClick={() => {
                  onToday();
                  setOpen(false);
                }}
              >
                Today
              </QuickJump>
              <QuickJump active={isLastMonth} onClick={() => applyQuick(-1)}>
                Last month
              </QuickJump>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col bg-bg-panel px-3 pt-3 pb-3">
            <div className="mb-2 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setPickerYear((y) => y - 1)}
                aria-label="Previous year"
              >
                <ChevronLeft size={14} strokeWidth={1.5} />
              </Button>
              <NativeSelect
                size="sm"
                variant="ghost"
                value={pickerYear}
                onChange={(e) => setPickerYear(Number(e.target.value))}
                aria-label="Choose year"
                className="font-semibold tabular-nums"
              >
                {yearOptions.map((o) => (
                  <NativeSelectOption key={o.value} value={o.value}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setPickerYear((y) => y + 1)}
                disabled={pickerYear >= now.getFullYear()}
                aria-label="Next year"
              >
                <ChevronRight size={14} strokeWidth={1.5} />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-1">
              {shortMonths.map((label, i) => {
                const m = i + 1;
                const isActive = pickerYear === year && m === month;
                const isCurrent = pickerYear === now.getFullYear() && i === now.getMonth();
                const isFuture = pickerYear === now.getFullYear() && i > now.getMonth();
                return (
                  <Button
                    key={label}
                    type="button"
                    variant={isActive ? "default" : "ghost"}
                    onClick={() => jump(pickerYear, m)}
                    disabled={isFuture}
                    aria-label={`${longMonths[i]} ${pickerYear}`}
                    aria-pressed={isActive}
                    className={cn(
                      "h-9 capitalize",
                      !isActive && isCurrent && "text-signal ring-1 ring-signal/40 ring-inset",
                      isFuture && "opacity-30",
                    )}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </SignalPopover>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onNextMonth}
        disabled={!canGoNext}
        aria-label="Next month"
        className="pointer-coarse:size-11"
      >
        <ChevronRight size={14} strokeWidth={1.5} />
      </Button>
    </div>
  );
}
