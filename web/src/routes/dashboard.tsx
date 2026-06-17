import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "../app/screens/DashboardView";
import { useAccounts } from "../lib/hooks/useAccounts";
import {
  useDailyPnl,
  useEquityCurve,
  useSummary,
} from "../lib/hooks/useAnalytics";
import { useTrades } from "../lib/hooks/useTrades";
import { useFilterParams, useFilters } from "../lib/filters";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based

  const summaryQ = useSummary(filters);
  const equityQ = useEquityCurve(filters);
  const dailyQ = useDailyPnl(filters);
  const tradesQ = useTrades(filters);
  const accountsQ = useAccounts();

  // Sort trades by closed_at desc and slice most recent 10
  const recentTrades = [...(tradesQ.data ?? [])]
    .filter((t) => t.closed_at != null)
    .sort(
      (a, b) =>
        new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime(),
    )
    .slice(0, 10);

  return (
    <DashboardView
      summaryLoading={summaryQ.isLoading}
      summaryError={summaryQ.isError}
      summary={summaryQ.data}
      equityLoading={equityQ.isLoading}
      equityError={equityQ.isError}
      equityPoints={equityQ.data?.points ?? []}
      dailyLoading={dailyQ.isLoading}
      dailyError={dailyQ.isError}
      dailyPnl={dailyQ.data ?? {}}
      tradesLoading={tradesQ.isLoading}
      tradesError={tradesQ.isError}
      trades={recentTrades}
      accounts={accountsQ.data ?? []}
      selectedAccountId={accountId}
      year={year}
      month={month}
    />
  );
}
