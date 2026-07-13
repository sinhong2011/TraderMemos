import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarView } from "../app/screens/CalendarView";
import { buildDayRecords } from "../lib/calendar";
import { useFilterParams, useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useDailyPnl, useSummary } from "../lib/hooks/useAnalytics";
import { useTrades } from "../lib/hooks/useTrades";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

function monthRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${pad(month)}-01T00:00:00Z`,
    to: `${year}-${pad(month)}-${pad(lastDay)}T23:59:59Z`,
  };
}

function CalendarPage() {
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);
  const accountsQ = useAccounts();
  const navigate = useNavigate();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Month-scoped heatmap + stats + records: the visible month is the scope
  // here, so the global date-range filter never starves the day cells.
  const range = monthRange(year, month);
  const monthFilters = { ...filters, from: range.from, to: range.to };
  const dailyQ = useDailyPnl(monthFilters);
  const monthSummaryQ = useSummary(monthFilters);
  const monthTradesQ = useTrades(monthFilters);
  const records = buildDayRecords(monthTradesQ.data ?? []);

  // Day drill-in
  const dayFilters = selectedDay
    ? {
        ...filters,
        from: `${selectedDay}T00:00:00Z`,
        to: `${selectedDay}T23:59:59Z`,
      }
    : {
        account_id: undefined,
        from: undefined,
        to: undefined,
        symbol: undefined,
      };
  const dayTradesQ = useTrades(dayFilters);

  const accounts = accountsQ.data ?? [];
  const currency = accounts.find((a) => a.id === accountId)?.base_currency ?? "USD";

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

  return (
    <CalendarView
      dailyPnl={dailyQ.data ?? {}}
      dailyLoading={dailyQ.isLoading}
      dailyError={dailyQ.isError}
      records={records}
      monthSummary={monthSummaryQ.data}
      accounts={accounts}
      selectedAccountId={accountId}
      year={year}
      month={month}
      onPrevMonth={() => shiftMonth(-1)}
      onNextMonth={() => shiftMonth(1)}
      onToday={() => jumpToMonth(now.getFullYear(), now.getMonth() + 1)}
      onJumpToMonth={jumpToMonth}
      canGoNext={!isCurrentMonth}
      selectedDay={selectedDay}
      onSelectDay={setSelectedDay}
      dayTrades={selectedDay ? (dayTradesQ.data ?? []) : []}
      dayTradesLoading={selectedDay ? dayTradesQ.isLoading : false}
      dayTradesError={selectedDay ? dayTradesQ.isError : false}
      currency={currency}
      onSelectTrade={(t) => navigate({ to: "/trades/$id", params: { id: t.id } })}
    />
  );
}
