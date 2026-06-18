import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ReportsView, type BreakdownDim } from "../app/screens/ReportsView";
import { useBreakdown } from "../lib/hooks/useAnalytics";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useFilterParams, useFilters } from "../lib/filters";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);
  const [dim, setDim] = useState<BreakdownDim>("symbol");

  const breakdownQ = useBreakdown(dim, filters);
  const accountsQ = useAccounts();
  const currency =
    (accountsQ.data ?? []).find((a) => a.id === accountId)?.base_currency ?? "USD";

  return (
    <ReportsView
      breakdown={breakdownQ.data ?? []}
      loading={breakdownQ.isLoading}
      error={breakdownQ.isError}
      currency={currency}
      dim={dim}
      onDimChange={setDim}
    />
  );
}
