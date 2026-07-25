import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  type BreakdownDim,
  REPORT_TABS,
  type ReportsTab,
  ReportsView,
} from "@/app/screens/ReportsView";
import type { ReportsDuration, ReportsSide } from "@/components/ReportsControlBar";
import type { PnlMode, UnitMode } from "@/components/ReportsDisplayContext";
import { TradeDetailSheet } from "@/components/TradeDetailSheet";
import { ytdFiltersForYear } from "@/lib/annualGoal";
import { tradesOnDay } from "@/lib/calendar";
import { accountBaseCurrency } from "@/lib/displayPrefs";
import { useFilterParams, useFilters } from "@/lib/filters";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useBreakdown, useEquityCurve, useRSummary, useSummary } from "@/lib/hooks/useAnalytics";
import { useAnnualGoal, useClearAnnualGoal, useSaveAnnualGoal } from "@/lib/hooks/useAnnualGoal";
import { useTrades } from "@/lib/hooks/useTrades";

const REPORT_TAB_VALUES: ReportsTab[] = REPORT_TABS.map((t) => t.value);
const SIDE_VALUES: ReportsSide[] = ["all", "long", "short"];
const DUR_VALUES: ReportsDuration[] = ["all", "scalp", "day", "swing"];
const PNL_VALUES: PnlMode[] = ["net", "gross"];
const UNIT_VALUES: UnitMode[] = ["abs", "pct"];

export function validateReportsSearch(search: Record<string, unknown>): {
  tab: ReportsTab;
  side: ReportsSide;
  dur: ReportsDuration;
  pnl: PnlMode;
  unit: UnitMode;
} {
  const tab = search.tab;
  const side = search.side;
  const dur = search.dur;
  const pnl = search.pnl;
  const unit = search.unit;
  return {
    tab: REPORT_TAB_VALUES.includes(tab as ReportsTab) ? (tab as ReportsTab) : "overview",
    side: SIDE_VALUES.includes(side as ReportsSide) ? (side as ReportsSide) : "all",
    dur: DUR_VALUES.includes(dur as ReportsDuration) ? (dur as ReportsDuration) : "all",
    pnl: PNL_VALUES.includes(pnl as PnlMode) ? (pnl as PnlMode) : "net",
    unit: UNIT_VALUES.includes(unit as UnitMode) ? (unit as UnitMode) : "abs",
  };
}

export const Route = createFileRoute("/reports")({
  validateSearch: validateReportsSearch,
  component: ReportsPage,
});

function ReportsPage() {
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);
  const setSymbol = useFilters((s) => s.setSymbol);
  const [dim, setDim] = useState<BreakdownDim>("setup");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const { tab, side, dur, pnl, unit } = Route.useSearch();
  const navigate = Route.useNavigate();
  const goalYear = new Date().getFullYear();
  const onTabChange = (next: ReportsTab) =>
    void navigate({ to: "/reports", search: (prev) => ({ ...prev, tab: next }) });
  const onSideChange = (next: ReportsSide) =>
    void navigate({ to: "/reports", search: (prev) => ({ ...prev, side: next }) });
  const onDurationChange = (next: ReportsDuration) =>
    void navigate({ to: "/reports", search: (prev) => ({ ...prev, dur: next }) });
  const onPnlModeChange = (next: PnlMode) =>
    void navigate({ to: "/reports", search: (prev) => ({ ...prev, pnl: next }) });
  const onUnitModeChange = (next: UnitMode) =>
    void navigate({ to: "/reports", search: (prev) => ({ ...prev, unit: next }) });

  const analyticsFilters = useMemo(
    () => ({
      ...filters,
      side: side === "all" ? undefined : side,
      duration: dur === "all" ? undefined : dur,
    }),
    [filters, side, dur],
  );
  const ytdFilters = useMemo(
    () => ytdFiltersForYear(analyticsFilters, goalYear),
    [analyticsFilters, goalYear],
  );

  const summaryQ = useSummary(analyticsFilters);
  const ytdSummaryQ = useSummary(ytdFilters);
  const rSummaryQ = useRSummary(analyticsFilters);
  const equityQ = useEquityCurve(analyticsFilters);
  const tradesQ = useTrades(analyticsFilters);
  const dayTrades = useMemo(() => {
    if (!selectedDay) return [];
    return tradesOnDay(tradesQ.data ?? [], selectedDay, "close");
  }, [selectedDay, tradesQ.data]);
  const breakdownQ = useBreakdown(dim, analyticsFilters);
  const dayOfWeekBreakdownQ = useBreakdown("day_of_week", analyticsFilters);
  const hourOfDayBreakdownQ = useBreakdown("hour_of_day", analyticsFilters);
  const symbolBreakdownQ = useBreakdown("symbol", analyticsFilters);
  const tagBreakdownQ = useBreakdown("tag", analyticsFilters);
  const sessionBreakdownQ = useBreakdown("session", analyticsFilters);
  const qualityBreakdownQ = useBreakdown("trade_quality", analyticsFilters);
  const accountsQ = useAccounts();
  const annualGoalQ = useAnnualGoal(goalYear);
  const saveAnnualGoalM = useSaveAnnualGoal();
  const clearAnnualGoalM = useClearAnnualGoal();
  const currency = accountBaseCurrency(accountsQ.data ?? [], accountId);
  const denominator = useMemo(() => {
    const accts = accountsQ.data ?? [];
    const scope = accountId ? accts.filter((a) => a.id === accountId) : accts;
    return scope.reduce((sum, a) => sum + (a.starting_balance || 0), 0);
  }, [accountsQ.data, accountId]);

  return (
    <>
      <ReportsView
        summary={summaryQ.data}
        summaryLoading={summaryQ.isLoading}
        summaryError={summaryQ.isError}
        rSummary={rSummaryQ.data}
        rSummaryLoading={rSummaryQ.isLoading}
        rSummaryError={rSummaryQ.isError}
        trades={tradesQ.data ?? []}
        tradesLoading={tradesQ.isLoading}
        tradesError={tradesQ.isError}
        equity={equityQ.data}
        equityLoading={equityQ.isLoading}
        equityError={equityQ.isError}
        breakdown={breakdownQ.data ?? []}
        loading={breakdownQ.isLoading}
        error={breakdownQ.isError}
        dayOfWeekBreakdown={dayOfWeekBreakdownQ.data ?? []}
        dayOfWeekBreakdownLoading={dayOfWeekBreakdownQ.isLoading}
        dayOfWeekBreakdownError={dayOfWeekBreakdownQ.isError}
        hourOfDayBreakdown={hourOfDayBreakdownQ.data ?? []}
        hourOfDayBreakdownLoading={hourOfDayBreakdownQ.isLoading}
        hourOfDayBreakdownError={hourOfDayBreakdownQ.isError}
        symbolBreakdown={symbolBreakdownQ.data ?? []}
        symbolBreakdownLoading={symbolBreakdownQ.isLoading}
        symbolBreakdownError={symbolBreakdownQ.isError}
        tagBreakdown={tagBreakdownQ.data ?? []}
        tagBreakdownLoading={tagBreakdownQ.isLoading}
        tagBreakdownError={tagBreakdownQ.isError}
        sessionBreakdown={sessionBreakdownQ.data ?? []}
        sessionBreakdownLoading={sessionBreakdownQ.isLoading}
        sessionBreakdownError={sessionBreakdownQ.isError}
        qualityBreakdown={qualityBreakdownQ.data ?? []}
        qualityBreakdownLoading={qualityBreakdownQ.isLoading}
        qualityBreakdownError={qualityBreakdownQ.isError}
        currency={currency}
        dim={dim}
        onDimChange={setDim}
        tab={tab}
        onTabChange={onTabChange}
        side={side}
        duration={dur}
        onSideChange={onSideChange}
        onDurationChange={onDurationChange}
        pnlMode={pnl}
        unitMode={unit}
        denominator={denominator}
        onPnlModeChange={onPnlModeChange}
        onUnitModeChange={onUnitModeChange}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        dayTrades={dayTrades}
        dayTradesLoading={Boolean(selectedDay) && tradesQ.isLoading}
        dayTradesError={Boolean(selectedDay) && tradesQ.isError}
        onSelectTrade={(t) => setSelectedTradeId(t.id)}
        onOpenFullPage={(t) => void navigate({ to: "/trades/$id", params: { id: t.id } })}
        onFilterSymbol={(symbol) => setSymbol(symbol)}
        onTradeDeleted={(t) => {
          if (selectedTradeId === t.id) setSelectedTradeId(null);
        }}
        goalYear={goalYear}
        goalAmount={annualGoalQ.data?.amount}
        goalLoading={annualGoalQ.isLoading}
        goalSaving={saveAnnualGoalM.isPending || clearAnnualGoalM.isPending}
        ytdNetPnl={ytdSummaryQ.data?.net_pnl}
        ytdLoading={ytdSummaryQ.isLoading}
        onSaveGoal={async (amount) => {
          await saveAnnualGoalM.mutateAsync({ year: goalYear, amount });
        }}
        onClearGoal={async () => {
          await clearAnnualGoalM.mutateAsync(goalYear);
        }}
      />
      <TradeDetailSheet tradeId={selectedTradeId} onClose={() => setSelectedTradeId(null)} />
    </>
  );
}
