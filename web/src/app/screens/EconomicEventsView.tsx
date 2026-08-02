import { CalendarX2, CloudAlert } from "lucide-react";
import { useMemo } from "react";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { FacetedFilter } from "@/components/FacetedFilter";
import { Page } from "@/components/Page";
import { PeriodNav } from "@/components/PeriodNav";
import { Badge } from "@/components/reui/badge";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";
import { Button } from "@/components/ui/button";
import type { EconomicEvent, EconomicImpact } from "@/lib/api/economicEvents";
import { dayKeyInTz } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { getDisplayTimeOpts } from "@/lib/displayPrefs";
import { fmtTime } from "@/lib/format";
import { intlLocale } from "@/lib/locale";

export const IMPACT_VALUES: EconomicImpact[] = ["high", "medium", "low", "holiday"];

const IMPACT_META: Record<
  EconomicImpact,
  { label: string; variant: "destructive-light" | "warning-light" | "secondary" | "info-light" }
> = {
  high: { label: "High", variant: "destructive-light" },
  medium: { label: "Medium", variant: "warning-light" },
  low: { label: "Low", variant: "secondary" },
  holiday: { label: "Holiday", variant: "info-light" },
};

/** Sunday day-key of the week `offsetWeeks` from today, on the trader's clock. */
export function weekStartKey(offsetWeeks: number, timeZone?: string): string {
  const todayKey = dayKeyInTz(new Date().toISOString(), timeZone);
  const base = new Date(`${todayKey}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() - base.getUTCDay() + offsetWeeks * 7);
  return base.toISOString().slice(0, 10);
}

export function addDaysKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(weekStart: string, locale: string): string {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(`${addDaysKey(weekStart, 6)}T12:00:00Z`);
  const opts = { month: "short", day: "numeric", timeZone: "UTC" } as const;
  const startLabel = start.toLocaleDateString(locale, opts);
  const endLabel = end.toLocaleDateString(locale, {
    ...opts,
    ...(start.getUTCMonth() === end.getUTCMonth() ? { month: undefined } : {}),
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

function formatDayHeader(dayKey: string, locale: string): string {
  return new Date(`${dayKey}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const ROW_GRID =
  "grid grid-cols-[3.25rem_2.5rem_4.5rem_minmax(0,1fr)] items-center gap-2 px-4 " +
  "sm:grid-cols-[3.25rem_2.5rem_4.5rem_minmax(0,1fr)_4.5rem_4.5rem]";

export interface EconomicEventsViewProps {
  /** Events already clipped to the visible week, sorted by time. */
  events: EconomicEvent[];
  loading: boolean;
  error: boolean;
  weekStart: string;
  isCurrentWeek: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
  impact?: string[];
  onImpactChange: (next?: string[]) => void;
  currencies?: string[];
  onCurrenciesChange: (next?: string[]) => void;
}

export function EconomicEventsView({
  events,
  loading,
  error,
  weekStart,
  isCurrentWeek,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  impact,
  onImpactChange,
  currencies,
  onCurrenciesChange,
}: EconomicEventsViewProps) {
  const locale = intlLocale();
  const { timeZone } = getDisplayTimeOpts();
  const todayKey = dayKeyInTz(new Date().toISOString(), timeZone);
  const now = Date.now();

  const currencyOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ev of events) counts.set(ev.country, (counts.get(ev.country) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, count]) => ({ value, label: value, count }));
  }, [events]);

  const impactSet = impact?.length ? new Set(impact) : null;
  const currencySet = currencies?.length ? new Set(currencies) : null;
  const filtered = events.filter(
    (ev) =>
      (!impactSet || impactSet.has(ev.impact)) && (!currencySet || currencySet.has(ev.country)),
  );

  const byDay = useMemo(() => {
    const groups = new Map<string, EconomicEvent[]>();
    for (const ev of filtered) {
      const key = dayKeyInTz(ev.time, timeZone);
      const list = groups.get(key);
      if (list) list.push(ev);
      else groups.set(key, [ev]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, timeZone]);

  const hasActual = filtered.some((ev) => ev.actual !== "");
  const filtersActive = impactSet != null || currencySet != null;

  function renderContent() {
    if (loading) {
      return <ListSkeleton rows={8} className="px-4 pt-2" />;
    }
    if (error) {
      return (
        <EmptyState
          icon={<CloudAlert size={20} strokeWidth={1.75} />}
          title="Couldn't load events"
          hint="The calendar feed or API is unreachable. Try again in a minute."
        />
      );
    }
    if (byDay.length === 0) {
      return (
        <EmptyState
          icon={<CalendarX2 size={20} strokeWidth={1.75} />}
          title={filtersActive ? "No events match the filters" : "No events this week"}
          hint={
            filtersActive
              ? "Clear the impact or currency filters to see the full week."
              : "Older weeks only show events collected while the server was running."
          }
        />
      );
    }
    return (
      <div className="flex flex-col pb-2" role="table" aria-label="Economic events">
        <div
          role="row"
          className={cn(
            ROW_GRID,
            "pt-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
          )}
        >
          <span role="columnheader">Time</span>
          <span role="columnheader">Cur</span>
          <span role="columnheader">Impact</span>
          <span role="columnheader">Event</span>
          <span role="columnheader" className="hidden text-right sm:block">
            {hasActual ? "Actual" : "Forecast"}
          </span>
          <span role="columnheader" className="hidden text-right sm:block">
            {hasActual ? "Forecast" : "Previous"}
          </span>
        </div>
        {byDay.map(([dayKey, dayEvents]) => (
          <section key={dayKey} aria-label={formatDayHeader(dayKey, locale)}>
            <h3
              className={cn(
                "flex items-center gap-2 px-4 pt-4 pb-1 text-[11px] font-semibold",
                dayKey === todayKey ? "text-primary" : "text-muted-foreground",
              )}
            >
              {formatDayHeader(dayKey, locale)}
              {dayKey === todayKey ? (
                <Badge variant="primary-light" size="xs" radius="full">
                  Today
                </Badge>
              ) : null}
            </h3>
            {dayEvents.map((ev) => {
              const past = new Date(ev.time).getTime() < now;
              return (
                <div
                  key={ev.id}
                  role="row"
                  className={cn(
                    ROW_GRID,
                    "min-h-9 rounded-md py-1.5 transition-colors",
                    "hover:bg-accent",
                  )}
                >
                  <span className="text-[12px] tabular-nums text-muted-foreground">
                    {fmtTime(ev.time, locale)}
                  </span>
                  <span className="text-[12px] font-medium text-foreground">{ev.country}</span>
                  <Badge variant={IMPACT_META[ev.impact]?.variant ?? "secondary"} size="sm">
                    {IMPACT_META[ev.impact]?.label ?? ev.impact}
                  </Badge>
                  <span
                    className={cn(
                      "truncate text-[13px]",
                      past ? "text-muted-foreground" : "text-foreground",
                    )}
                    title={ev.title}
                  >
                    {ev.title}
                  </span>
                  <span className="hidden text-right text-[12px] tabular-nums text-foreground sm:block">
                    {(hasActual ? ev.actual : ev.forecast) || "—"}
                  </span>
                  <span className="hidden text-right text-[12px] tabular-nums text-muted-foreground sm:block">
                    {(hasActual ? ev.forecast : ev.previous) || "—"}
                  </span>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    );
  }

  return (
    <Page>
      <div className="flex flex-wrap items-center gap-2">
        <PeriodNav
          onPrev={onPrevWeek}
          onNext={onNextWeek}
          prevLabel="Previous week"
          nextLabel="Next week"
        >
          <span className="min-w-28 px-1 text-center text-[13px] font-semibold tabular-nums tracking-[-0.01em] text-foreground">
            {formatWeekLabel(weekStart, locale)}
          </span>
        </PeriodNav>
        {!isCurrentWeek ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onThisWeek}
            className="h-8 px-2.5 text-[12px] sm:h-7"
          >
            This week
          </Button>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <FacetedFilter
            title="Impact"
            multiple
            options={IMPACT_VALUES.map((v) => ({ value: v, label: IMPACT_META[v].label }))}
            value={impact}
            onChange={(next) =>
              onImpactChange(Array.isArray(next) ? next : next ? [next] : undefined)
            }
          />
          <FacetedFilter
            title="Currency"
            multiple
            options={currencyOptions}
            value={currencies}
            onChange={(next) =>
              onCurrenciesChange(Array.isArray(next) ? next : next ? [next] : undefined)
            }
          />
        </div>
      </div>
      <Card flush>{renderContent()}</Card>
    </Page>
  );
}
