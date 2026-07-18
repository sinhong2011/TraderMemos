import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { type BreakdownDim, ReportsView } from "../app/screens/ReportsView";
import { accountBaseCurrency } from "../lib/displayPrefs";
import { useFilterParams, useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useBreakdown, useEquityCurve, useRSummary, useSummary } from "../lib/hooks/useAnalytics";
import { useTrades } from "../lib/hooks/useTrades";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);
  const [dim, setDim] = useState<BreakdownDim>("setup");

  const summaryQ = useSummary(filters);
  const rSummaryQ = useRSummary(filters);
  const equityQ = useEquityCurve(filters);
  const tradesQ = useTrades(filters);
  const breakdownQ = useBreakdown(dim, filters);
  const dayOfWeekBreakdownQ = useBreakdown("day_of_week", filters);
  const hourOfDayBreakdownQ = useBreakdown("hour_of_day", filters);
  const symbolBreakdownQ = useBreakdown("symbol", filters);
  const tagBreakdownQ = useBreakdown("tag", filters);
  const sessionBreakdownQ = useBreakdown("session", filters);
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
      currency={currency}
      dim={dim}
      onDimChange={setDim}
    />
  );
}
