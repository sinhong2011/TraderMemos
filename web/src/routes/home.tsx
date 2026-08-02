import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HomeView } from "@/app/screens/HomeView";
import type { HomeBreakdownDim } from "@/components/HomeBreakdownChart";
import { TradeDetailSheet } from "@/components/TradeDetailSheet";
import { ytdFiltersForYear } from "@/lib/annualGoal";
import { buildDayRecords, dayKeyInTz } from "@/lib/calendar";
import { normalizeFilterDate, useFilterParams, useFilters } from "@/lib/filters";
import { computeHeaderStats } from "@/lib/headerStats";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useBreakdown, useDailyPnl, useEquityCurve, useSummary } from "@/lib/hooks/useAnalytics";
import { useAnnualGoal, useClearAnnualGoal, useSaveAnnualGoal } from "@/lib/hooks/useAnnualGoal";
import { useCash } from "@/lib/hooks/useCash";
import { useTrades } from "@/lib/hooks/useTrades";
import { filterTradesByStatus } from "@/lib/tradeFilters";
import { useUI } from "@/lib/ui";

export const Route = createFileRoute("/home")({
  component: HomePage,
});

function monthRange(year: number, month: number, tz: string) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: normalizeFilterDate(`${year}-${pad(month)}-01`, "start", tz),
    to: normalizeFilterDate(`${year}-${pad(month)}-${pad(lastDay)}`, "end", tz),
  };
}

function HomePage() {
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);
  const tradeStatusFilter = useFilters((s) => s.tradeStatus);
  const toggleTradeStatus = useFilters((s) => s.toggleTradeStatus);
  const setSymbol = useFilters((s) => s.setSymbol);
  const navigate = useNavigate();
  const openModal = useUI((s) => s.openModal);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [breakdownDim, setBreakdownDim] = useState<HomeBreakdownDim>("day_of_week");

  const now = new Date();
  const calendarYear = now.getFullYear();
  const calendarMonth = now.getMonth() + 1;
  const range = monthRange(calendarYear, calendarMonth, filters.tz);
  const monthFilters = { ...filters, from: range.from, to: range.to };
  const ytdFilters = useMemo(
    () => ytdFiltersForYear(filters, calendarYear),
    [filters, calendarYear],
  );

  const summaryQ = useSummary(filters);
  const ytdSummaryQ = useSummary(ytdFilters);
  const equityQ = useEquityCurve(filters);
  const tradesQ = useTrades(filters);
  const monthTradesQ = useTrades(monthFilters);
  const accountsQ = useAccounts();
  const cashQ = useCash(filters);
  const dailyQ = useDailyPnl(monthFilters);
  const breakdownQ = useBreakdown(breakdownDim, filters);
  const annualGoalQ = useAnnualGoal(calendarYear);
  const saveAnnualGoalM = useSaveAnnualGoal();
  const clearAnnualGoalM = useClearAnnualGoal();

  const trades = filterTradesByStatus(
    [...(tradesQ.data ?? [])].sort(
      (a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime(),
    ),
    tradeStatusFilter,
  );
  const calendarDayRecords = useMemo(
    () => buildDayRecords(monthTradesQ.data ?? [], "close", filters.tz),
    [monthTradesQ.data, filters.tz],
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
      <HomeView
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
        onDeleted={(t) => {
          if (selectedTradeId === t.id) setSelectedTradeId(null);
        }}
        onViewAllTrades={() => void navigate({ to: "/trades" })}
        onOpenCalendar={() => void navigate({ to: "/calendar" })}
        onOpenReports={() =>
          void navigate({
            to: "/reports",
            search: {
              tab: "overview",
              side: "all",
              dur: "all",
              pnl: "net",
              unit: "abs",
              avg: "mean",
            },
          })
        }
        calendarYear={calendarYear}
        calendarMonth={calendarMonth}
        dailyPnl={dailyQ.data ?? {}}
        todayNetPnl={dailyQ.data?.[dayKeyInTz(now.toISOString(), filters.tz)] ?? 0}
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
        goalYear={calendarYear}
        goalAmount={annualGoalQ.data?.amount}
        goalLoading={annualGoalQ.isLoading}
        goalSaving={saveAnnualGoalM.isPending || clearAnnualGoalM.isPending}
        ytdNetPnl={ytdSummaryQ.data?.net_pnl}
        ytdLoading={ytdSummaryQ.isLoading}
        onSaveGoal={async (amount) => {
          await saveAnnualGoalM.mutateAsync({ year: calendarYear, amount });
        }}
        onClearGoal={async () => {
          await clearAnnualGoalM.mutateAsync(calendarYear);
        }}
      />
      <TradeDetailSheet tradeId={selectedTradeId} onClose={() => setSelectedTradeId(null)} />
    </>
  );
}
