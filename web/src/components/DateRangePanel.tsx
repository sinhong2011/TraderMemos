import { format, isSameDay } from "date-fns";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/cn";
import {
  type DateRangePreset,
  PRESET_LABELS,
  computePresetRange,
  localDateString,
  parseFilterDay,
  presetFromRange,
} from "@/lib/dateRangePresets";
import { useFilters } from "@/lib/filters";
import { AppCalendar } from "./AppCalendar";
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
    return (
      <p className="m-0 text-[10px] uppercase tracking-widest text-chart-3">Select end date</p>
    );
  }
  if (draft?.from && draft.to) {
    return (
      <p className="m-0 text-[11px] tabular-nums text-muted-foreground">
        {format(draft.from, "MMM d, yyyy")}
        <span className="text-muted-foreground"> – </span>
        {format(draft.to, "MMM d, yyyy")}
      </p>
    );
  }
  return (
    <p className="m-0 text-[11px] text-muted-foreground">Click two dates for a custom range</p>
  );
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
        // Narrow: a 3-up grid. The old horizontal scroller clipped the last
        // preset mid-word with nothing to signal that it scrolled.
        "max-sm:grid max-sm:grid-cols-3 max-sm:gap-1.5 max-sm:px-2 max-sm:pb-1",
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
              "relative h-auto justify-start rounded-md text-left text-[11px]",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              // In the grid each preset is its own chip: a muted surface for
              // tap affordance, tint instead of a rail for the active one.
              "max-sm:justify-center max-sm:bg-muted/40 max-sm:px-1.5 max-sm:py-2 max-sm:text-center",
              "sm:w-full sm:py-2 sm:pr-2 sm:pl-2.5",
              active && "max-sm:bg-primary/12 max-sm:text-primary sm:bg-accent sm:text-foreground",
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute top-1/2 left-0 hidden h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary sm:block"
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
        // rounded-md keeps the nested surfaces (preset rail + calendar) on the
        // --radius scale one tier inside the popover's rounded-lg edge.
        "flex max-h-[min(100dvh-2rem,100%)] w-[min(100vw-2rem,424px)] flex-col overflow-y-auto overscroll-contain rounded-md",
        "pb-[env(safe-area-inset-bottom)] sm:w-[424px] sm:flex-row sm:pb-0",
      )}
      aria-label="Date range"
    >
      {/* Stacked on a phone the two surfaces read as unrelated bands, so the
          panel goes single-surface there and only splits on sm+. */}
      <aside className="flex shrink-0 flex-col rounded-md max-sm:pt-1 sm:w-[148px] sm:bg-background">
        <p className="m-0 px-3 pt-3 pb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground max-sm:px-2 max-sm:pt-0 max-sm:pb-1.5">
          Quick range
        </p>
        {presetList}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col sm:bg-card">
        <div className="flex justify-center px-3 pt-3 pb-1 max-sm:pt-2">
          <AppCalendar
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
