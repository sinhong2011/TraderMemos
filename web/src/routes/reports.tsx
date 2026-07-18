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
      currency={currency}
      dim={dim}
      onDimChange={setDim}
    />
  );
}
