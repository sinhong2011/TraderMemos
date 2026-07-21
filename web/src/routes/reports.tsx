import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  type BreakdownDim,
  REPORT_TABS,
  type ReportsTab,
  ReportsView,
} from "../app/screens/ReportsView";
import type { ReportsDuration, ReportsSide } from "../components/ReportsControlBar";
import { accountBaseCurrency } from "../lib/displayPrefs";
import { useFilterParams, useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useBreakdown, useEquityCurve, useRSummary, useSummary } from "../lib/hooks/useAnalytics";
import { useTrades } from "../lib/hooks/useTrades";

const REPORT_TAB_VALUES: ReportsTab[] = REPORT_TABS.map((t) => t.value);
const SIDE_VALUES: ReportsSide[] = ["all", "long", "short"];
const DUR_VALUES: ReportsDuration[] = ["all", "scalp", "day", "swing"];

export function validateReportsSearch(search: Record<string, unknown>): {
  tab: ReportsTab;
  side: ReportsSide;
  dur: ReportsDuration;
} {
  const tab = search.tab;
  const side = search.side;
  const dur = search.dur;
  return {
    tab: REPORT_TAB_VALUES.includes(tab as ReportsTab) ? (tab as ReportsTab) : "overview",
    side: SIDE_VALUES.includes(side as ReportsSide) ? (side as ReportsSide) : "all",
    dur: DUR_VALUES.includes(dur as ReportsDuration) ? (dur as ReportsDuration) : "all",
  };
}

export const Route = createFileRoute("/reports")({
  validateSearch: validateReportsSearch,
  component: ReportsPage,
});

function ReportsPage() {
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);
  const [dim, setDim] = useState<BreakdownDim>("setup");
  const { tab, side, dur } = Route.useSearch();
  const navigate = Route.useNavigate();
  const onTabChange = (next: ReportsTab) =>
    void navigate({ to: "/reports", search: (prev) => ({ ...prev, tab: next }) });
  const onSideChange = (next: ReportsSide) =>
    void navigate({ to: "/reports", search: (prev) => ({ ...prev, side: next }) });
  const onDurationChange = (next: ReportsDuration) =>
    void navigate({ to: "/reports", search: (prev) => ({ ...prev, dur: next }) });

  const analyticsFilters = useMemo(
    () => ({
      ...filters,
      side: side === "all" ? undefined : side,
      duration: dur === "all" ? undefined : dur,
    }),
    [filters, side, dur],
  );

  const summaryQ = useSummary(analyticsFilters);
  const rSummaryQ = useRSummary(analyticsFilters);
  const equityQ = useEquityCurve(analyticsFilters);
  const tradesQ = useTrades(analyticsFilters);
  const breakdownQ = useBreakdown(dim, analyticsFilters);
  const dayOfWeekBreakdownQ = useBreakdown("day_of_week", analyticsFilters);
  const hourOfDayBreakdownQ = useBreakdown("hour_of_day", analyticsFilters);
  const symbolBreakdownQ = useBreakdown("symbol", analyticsFilters);
  const tagBreakdownQ = useBreakdown("tag", analyticsFilters);
  const sessionBreakdownQ = useBreakdown("session", analyticsFilters);
  const qualityBreakdownQ = useBreakdown("trade_quality", analyticsFilters);
  const accountsQ = useAccounts();
  const currency = accountBaseCurrency(accountsQ.data ?? [], accountId);

  return (
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
    />
  );
}
