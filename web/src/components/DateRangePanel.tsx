import { format, isSameDay } from "date-fns";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { cn } from "../lib/cn";
import {
  type DateRangePreset,
  PRESET_LABELS,
  computePresetRange,
  localDateString,
  parseFilterDay,
  presetFromRange,
} from "../lib/dateRangePresets";
import { useFilters } from "../lib/filters";
import { SignalCalendar } from "./SignalCalendar";
import { Button } from "./ui/button";

const PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: "7d", label: PRESET_LABELS["7d"] },
  { key: "30d", label: PRESET_LABELS["30d"] },
  { key: "90d", label: PRESET_LABELS["90d"] },
  { key: "mtd", label: PRESET_LABELS.mtd },
  { key: "ytd", label: PRESET_LABELS.ytd },
  { key: "all", label: PRESET_LABELS.all },
];

function toDraft(from?: string, to?: string): DateRange | undefined {
  const fromDate = parseFilterDay(from);
  const toDate = parseFilterDay(to);
  if (!fromDate && !toDate) return undefined;
  return { from: fromDate, to: toDate };
}

function RangeFooter({ draft }: { draft: DateRange | undefined }) {
  if (draft?.from && !draft.to) {
    return <p className="m-0 text-[10px] uppercase tracking-widest text-signal">Select end date</p>;
  }
  if (draft?.from && draft.to) {
    return (
      <p className="m-0 text-[11px] tabular-nums text-text-muted">
        {format(draft.from, "MMM d, yyyy")}
        <span className="text-text-dim"> – </span>
        {format(draft.to, "MMM d, yyyy")}
      </p>
    );
  }
  return <p className="m-0 text-[11px] text-text-muted">Click two dates for a custom range</p>;
}

export function DateRangePanel({ onApplied }: { onApplied?: () => void }) {
  const { from, to, setRange } = useFilters();
  const [draft, setDraft] = useState<DateRange | undefined>(() => toDraft(from, to));

  useEffect(() => {
    setDraft(toDraft(from, to));
  }, [from, to]);

  const activePreset = presetFromRange(from, to);
  const now = new Date();
  const minYear = Math.min(
    now.getFullYear() - 10,
    draft?.from?.getFullYear() ?? Number.POSITIVE_INFINITY,
  );

  function applyPreset(key: DateRangePreset) {
    const { from: f, to: t } = computePresetRange(key);
    setRange(f, t);
    onApplied?.();
  }

  function applyCustomRange(range: DateRange | undefined) {
    // react-day-picker returns {from, to} on the same day for the first
    // click; hold it as a pending start so the user can pick an end date.
    // Clicking the same day again applies a one-day range.
    const clickedSingleDay = range?.from && range?.to && isSameDay(range.from, range.to);
    const pendingStart = draft?.from && !draft?.to;
    if (clickedSingleDay && !pendingStart) {
      setDraft({ from: range.from, to: undefined });
      return;
    }
    setDraft(range);
    if (range?.from && range?.to) {
      setRange(localDateString(range.from), localDateString(range.to));
      onApplied?.();
    }
  }

  const presetList = (
    <div
      className={cn(
        "flex gap-1 px-2 pb-3",
        // iOS / narrow: horizontal chips so the calendar keeps full width
        "max-sm:snap-x max-sm:snap-mandatory max-sm:flex-row max-sm:overflow-x-auto max-sm:overscroll-x-contain max-sm:pb-2",
        "[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden",
        "sm:flex-col sm:gap-0.5",
      )}
    >
      {PRESETS.map((p) => {
        const active = activePreset === p.key;
        return (
          <Button
            key={p.key}
            type="button"
            variant="ghost"
            onClick={() => applyPreset(p.key)}
            className={cn(
              "relative h-auto justify-start rounded-control text-left text-[11px]",
              "focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:outline-none",
              "max-sm:snap-start max-sm:shrink-0 max-sm:px-2.5 max-sm:py-2",
              "sm:w-full sm:py-2 sm:pr-2 sm:pl-2.5",
              active && "bg-bg-hover text-text",
            )}
          >
            {active && (
              <span
                aria-hidden
                className={cn(
                  "absolute rounded-full bg-accent",
                  "max-sm:inset-x-2 max-sm:bottom-0 max-sm:h-0.5",
                  "sm:top-1/2 sm:left-0 sm:h-4 sm:w-0.5 sm:-translate-y-1/2",
                )}
              />
            )}
            {p.label}
          </Button>
        );
      })}
    </div>
  );

  return (
    <div
      className={cn(
        "flex max-h-[min(100dvh-2rem,100%)] w-[min(100vw-2rem,424px)] flex-col overflow-y-auto overscroll-contain",
        "pb-[env(safe-area-inset-bottom)] sm:w-[424px] sm:flex-row sm:pb-0",
      )}
      aria-label="Date range"
    >
      <aside className="flex shrink-0 flex-col bg-bg sm:w-[148px]">
        <p className="m-0 px-3 pt-3 pb-2 text-[11px] font-medium uppercase tracking-widest text-text-muted">
          Quick range
        </p>
        {presetList}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-bg-panel">
        <div className="flex justify-center px-3 pt-3 pb-1 max-sm:pt-1">
          <SignalCalendar
            mode="range"
            selected={draft}
            onSelect={applyCustomRange}
            defaultMonth={draft?.from ?? draft?.to ?? now}
            numberOfMonths={1}
            disabled={{ after: now }}
            captionLayout="dropdown"
            startMonth={new Date(minYear, 0)}
            endMonth={now}
            className="p-0"
          />
        </div>
        <div className="mt-auto px-3 py-2.5">
          <RangeFooter draft={draft} />
        </div>
      </div>
    </div>
  );
}
