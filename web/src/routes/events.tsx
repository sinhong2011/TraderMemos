import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  addDaysKey,
  EconomicEventsView,
  IMPACT_VALUES,
  weekStartKey,
} from "@/app/screens/EconomicEventsView";
import { dayKeyInTz } from "@/lib/calendar";
import { getDisplayTimeOpts } from "@/lib/displayPrefs";
import { useEconomicEvents } from "@/lib/hooks/useEconomicEvents";

const MAX_WEEK_OFFSET = 104;

export function validateEventsSearch(search: Record<string, unknown>): {
  wk: number;
  imp?: string[];
  ccy?: string[];
} {
  const wkRaw = Number(search.wk);
  const wk = Number.isInteger(wkRaw)
    ? Math.max(-MAX_WEEK_OFFSET, Math.min(MAX_WEEK_OFFSET, wkRaw))
    : 0;

  const strings = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const imp = strings(search.imp).filter((v) => (IMPACT_VALUES as string[]).includes(v));
  const ccy = strings(search.ccy)
    .map((v) => v.toUpperCase())
    .filter((v) => /^[A-Z]{3}$/.test(v));

  return {
    wk,
    imp: imp.length ? imp : undefined,
    ccy: ccy.length ? ccy : undefined,
  };
}

export const Route = createFileRoute("/events")({
  validateSearch: validateEventsSearch,
  component: EventsPage,
});

function EventsPage() {
  const { wk, imp, ccy } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { timeZone } = getDisplayTimeOpts();

  const weekStart = weekStartKey(wk, timeZone);
  const weekEnd = addDaysKey(weekStart, 7);

  // Fetch one day beyond each edge so display-timezone day grouping never
  // drops an event that sits across the UTC week boundary.
  const eventsQ = useEconomicEvents({
    from: addDaysKey(weekStart, -1),
    to: addDaysKey(weekStart, 8),
  });

  const weekEvents = useMemo(() => {
    const rows = eventsQ.data ?? [];
    return rows.filter((ev) => {
      const key = dayKeyInTz(ev.time, timeZone);
      return key >= weekStart && key < weekEnd;
    });
  }, [eventsQ.data, timeZone, weekStart, weekEnd]);

  const setWeek = (next: number) =>
    void navigate({ to: "/events", search: (prev) => ({ ...prev, wk: next }) });

  return (
    <EconomicEventsView
      events={weekEvents}
      loading={eventsQ.isLoading}
      error={eventsQ.isError}
      weekStart={weekStart}
      isCurrentWeek={wk === 0}
      onPrevWeek={() => setWeek(wk - 1)}
      onNextWeek={() => setWeek(wk + 1)}
      onThisWeek={() => setWeek(0)}
      impact={imp}
      onImpactChange={(next) =>
        void navigate({ to: "/events", search: (prev) => ({ ...prev, imp: next }) })
      }
      currencies={ccy}
      onCurrenciesChange={(next) =>
        void navigate({ to: "/events", search: (prev) => ({ ...prev, ccy: next }) })
      }
    />
  );
}
