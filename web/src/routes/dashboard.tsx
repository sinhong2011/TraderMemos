import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DashboardView } from "../app/screens/DashboardView";
import type { DashboardBreakdownDim } from "../components/DashboardBreakdownChart";
import { TradeDetailSheet } from "../components/TradeDetailSheet";
import { buildDayRecords } from "../lib/calendar";
import { useFilterParams, useFilters } from "../lib/filters";
import { computeHeaderStats } from "../lib/headerStats";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useBreakdown, useDailyPnl, useEquityCurve, useSummary } from "../lib/hooks/useAnalytics";
import { useCash } from "../lib/hooks/useCash";
import { useTrades } from "../lib/hooks/useTrades";
import { filterTradesByStatus } from "../lib/tradeFilters";
import { useUI } from "../lib/ui";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function monthRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${pad(month)}-01T00:00:00Z`,
    to: `${year}-${pad(month)}-${pad(lastDay)}T23:59:59Z`,
  };
}

function DashboardPage() {
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);
  const tradeStatusFilter = useFilters((s) => s.tradeStatus);
  const toggleTradeStatus = useFilters((s) => s.toggleTradeStatus);
  const setSymbol = useFilters((s) => s.setSymbol);
  const navigate = useNavigate();
  const openModal = useUI((s) => s.openModal);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [breakdownDim, setBreakdownDim] = useState<DashboardBreakdownDim>("day_of_week");

  const now = new Date();
  const calendarYear = now.getFullYear();
  const calendarMonth = now.getMonth() + 1;
  const range = monthRange(calendarYear, calendarMonth);
  const monthFilters = { ...filters, from: range.from, to: range.to };

  const summaryQ = useSummary(filters);
  const equityQ = useEquityCurve(filters);
  const tradesQ = useTrades(filters);
  const monthTradesQ = useTrades(monthFilters);
  const accountsQ = useAccounts();
  const cashQ = useCash(filters);
  const dailyQ = useDailyPnl(monthFilters);
  const breakdownQ = useBreakdown(breakdownDim, filters);

  const trades = filterTradesByStatus(
    [...(tradesQ.data ?? [])].sort(
      (a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime(),
    ),
    tradeStatusFilter,
  );
  const calendarDayRecords = useMemo(
    () => buildDayRecords(monthTradesQ.data ?? []),
    [monthTradesQ.data],
  );

  const headerStats = computeHeaderStats({
    accounts: accountsQ.data ?? [],
    accountId,
    cashTx: cashQ.data ?? [],
    summary: summaryQ.data,
    trades: tradesQ.data ?? [],
  });

  return (
    <>
      <DashboardView
        summaryLoading={summaryQ.isLoading}
        summaryError={summaryQ.isError}
        summary={summaryQ.data}
        equityLoading={equityQ.isLoading}
        equityError={equityQ.isError}
        equityPoints={equityQ.data?.points ?? []}
        maxDrawdown={equityQ.data?.max_drawdown}
        tradesLoading={tradesQ.isLoading}
        tradesError={tradesQ.isError}
        trades={trades}
        accounts={accountsQ.data ?? []}
        selectedAccountId={accountId}
        tradeStatusFilter={tradeStatusFilter}
        onToggleTradeStatus={toggleTradeStatus}
        onSelectTrade={(t) => setSelectedTradeId(t.id)}
        onOpenFullPage={(t) => void navigate({ to: "/trades/$id", params: { id: t.id } })}
        onFilterSymbol={(symbol) => setSymbol(symbol)}
        onViewAllTrades={() => void navigate({ to: "/trades" })}
        onOpenCalendar={() => void navigate({ to: "/calendar" })}
        onOpenReports={() => void navigate({ to: "/reports" })}
        calendarYear={calendarYear}
        calendarMonth={calendarMonth}
        dailyPnl={dailyQ.data ?? {}}
        dayRecords={calendarDayRecords}
        dailyLoading={dailyQ.isLoading}
        dailyError={dailyQ.isError}
        breakdownDim={breakdownDim}
        onBreakdownDimChange={setBreakdownDim}
        breakdown={breakdownQ.data ?? []}
        breakdownLoading={breakdownQ.isLoading}
        breakdownError={breakdownQ.isError}
        accountFunded={headerStats.cash > 0}
        onImport={() => navigate({ to: "/import" })}
        onNewTrade={() => openModal("new-trade")}
      />
      <TradeDetailSheet tradeId={selectedTradeId} onClose={() => setSelectedTradeId(null)} />
    </>
  );
}
