import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarView, type CalendarMode } from "@/app/screens/CalendarView";
import { TradeDetailSheet } from "@/components/TradeDetailSheet";
import { buildDayRecords, tradeDayKey, tradesOnDay } from "@/lib/calendar";
import { accountBaseCurrency, useDisplayPrefs } from "@/lib/displayPrefs";
import { normalizeFilterDate, useFilterParams, useFilters } from "@/lib/filters";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useDailyPnl, useEquityCurve, useSummary } from "@/lib/hooks/useAnalytics";
import { useCash } from "@/lib/hooks/useCash";
import { useTrades } from "@/lib/hooks/useTrades";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

function monthRange(year: number, month: number, tz: string) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: normalizeFilterDate(`${year}-${pad(month)}-01`, "start", tz),
    to: normalizeFilterDate(`${year}-${pad(month)}-${pad(lastDay)}`, "end", tz),
  };
}

function yearRange(year: number, tz: string) {
  return {
    from: normalizeFilterDate(`${year}-01-01`, "start", tz),
    to: normalizeFilterDate(`${year}-12-31`, "end", tz),
  };
}

/** Trade counts keyed by "YYYY-MM" under the active date basis. */
function tradesByMonthKey(
  trades: { opened_at: string; closed_at: string | null; status: string }[],
  basis: "close" | "open",
  tz: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of trades) {
    if (t.status === "open") continue;
    const day = tradeDayKey(t, basis, tz);
    if (!day) continue;
    const key = day.slice(0, 7);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function CalendarPage() {
  const navigate = useNavigate();
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);
  const tradeDateBasis = useDisplayPrefs((s) => s.tradeDateBasis);
  const accountsQ = useAccounts();
  const cashQ = useCash(filters);
  // All-time curve (no from/to): its points carry the running balance, which
  // funds day/week start-balance readings regardless of the visible month.
  const equityQ = useEquityCurve({
    account_id: filters.account_id,
    date_basis: filters.date_basis,
    tz: filters.tz,
  });

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [mode, setMode] = useState<CalendarMode>("month");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);

  const tz = filters.tz;
  const range = monthRange(year, month, tz);
  const monthFilters = { ...filters, from: range.from, to: range.to };
  const dailyQ = useDailyPnl(monthFilters);
  const monthSummaryQ = useSummary(monthFilters);
  const monthTradesQ = useTrades(monthFilters);
  const records = useMemo(
    () => buildDayRecords(monthTradesQ.data ?? [], tradeDateBasis, tz),
    [monthTradesQ.data, tradeDateBasis, tz],
  );

  const yRange = yearRange(year, tz);
  const yearFilters = { ...filters, from: yRange.from, to: yRange.to };
  const yearDailyQ = useDailyPnl(yearFilters);
  const yearTradesQ = useTrades(yearFilters);
  const yearTradesByMonth = useMemo(
    () => tradesByMonthKey(yearTradesQ.data ?? [], tradeDateBasis, tz),
    [yearTradesQ.data, tradeDateBasis, tz],
  );
  const yearDayRecords = useMemo(
    () => buildDayRecords(yearTradesQ.data ?? [], tradeDateBasis, tz),
    [yearTradesQ.data, tradeDateBasis, tz],
  );

  // Drawer uses the same date basis as heatmap / "N trades" counts.
  const scopeTradesQ = mode === "year" ? yearTradesQ : monthTradesQ;
  const dayTrades = useMemo(() => {
    if (!selectedDay) return [];
    return tradesOnDay(scopeTradesQ.data ?? [], selectedDay, tradeDateBasis, tz);
  }, [selectedDay, scopeTradesQ.data, tradeDateBasis, tz]);

  const accounts = accountsQ.data ?? [];
  const currency = accountBaseCurrency(accounts, accountId);

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setSelectedDay(null);
  }

  function jumpToMonth(y: number, m: number) {
    setYear(y);
    setMonth(m);
    setSelectedDay(null);
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const isCurrentYear = year === now.getFullYear();

  return (
    <>
      <CalendarView
        dailyPnl={dailyQ.data ?? {}}
        dailyLoading={dailyQ.isLoading}
        dailyError={dailyQ.isError}
        yearDailyPnl={yearDailyQ.data ?? {}}
        yearDailyLoading={yearDailyQ.isLoading}
        yearDailyError={yearDailyQ.isError}
        yearTradesByMonth={yearTradesByMonth}
        yearDayRecords={yearDayRecords}
        records={records}
        monthTrades={monthTradesQ.data ?? []}
        yearTradeList={yearTradesQ.data ?? []}
        monthSummary={monthSummaryQ.data}
        accounts={accounts}
        cashTx={cashQ.data ?? []}
        equityPoints={equityQ.data?.points ?? []}
        selectedAccountId={accountId}
        year={year}
        month={month}
        mode={mode}
        onModeChange={(next) => {
          setMode(next);
          setSelectedDay(null);
        }}
        onPrevMonth={() => shiftMonth(-1)}
        onNextMonth={() => shiftMonth(1)}
        onPrevYear={() => {
          setYear((y) => y - 1);
          setSelectedDay(null);
        }}
        onNextYear={() => {
          setYear((y) => Math.min(y + 1, now.getFullYear()));
          setSelectedDay(null);
        }}
        onToday={() => jumpToMonth(now.getFullYear(), now.getMonth() + 1)}
        onJumpToMonth={jumpToMonth}
        canGoNextMonth={!isCurrentMonth}
        canGoNextYear={!isCurrentYear}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        dayTrades={dayTrades}
        dayTradesLoading={Boolean(selectedDay) && scopeTradesQ.isLoading}
        dayTradesError={Boolean(selectedDay) && scopeTradesQ.isError}
        currency={currency}
        onSelectTrade={(t) => setSelectedTradeId(t.id)}
        onOpenDayReview={(day) => void navigate({ to: "/day/$date", params: { date: day } })}
      />
      <TradeDetailSheet tradeId={selectedTradeId} onClose={() => setSelectedTradeId(null)} />
    </>
  );
}
