import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PnlHeatmapView } from "@/app/screens/PnlHeatmapView";
import { CHART_TIME_ZONE } from "@/components/charts/chartTime";
import { accountBaseCurrency } from "@/lib/displayPrefs";
import { useFilters } from "@/lib/filters";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useMoneyFx } from "@/lib/hooks/useMoneyFx";
import { useTrades } from "@/lib/hooks/useTrades";
import { computePnlHeatmap } from "@/lib/pnlHeatmap";

export const Route = createFileRoute("/heatmap")({
  component: HeatmapPage,
});

function HeatmapPage() {
  const accountId = useFilters((s) => s.accountId);

  // All-time trades, honoring the account filter like the rest of the app.
  const filters = useMemo(() => (accountId ? { account_id: accountId } : {}), [accountId]);
  const tradesQ = useTrades(filters);
  const accountsQ = useAccounts();
  const baseCurrency = accountBaseCurrency(accountsQ.data ?? [], accountId);
  const { currency, rate } = useMoneyFx(baseCurrency);

  const heatmap = useMemo(
    () => computePnlHeatmap(tradesQ.data ?? [], CHART_TIME_ZONE),
    [tradesQ.data],
  );

  return (
    <PnlHeatmapView
      heatmap={heatmap}
      loading={tradesQ.isLoading}
      error={tradesQ.isError}
      currency={currency}
      fxRate={rate ?? 1}
    />
  );
}
