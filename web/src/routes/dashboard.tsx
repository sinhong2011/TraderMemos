import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DashboardView } from "../app/screens/DashboardView";
import { useFilterParams, useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useEquityCurve, useSummary } from "../lib/hooks/useAnalytics";
import { useTrades } from "../lib/hooks/useTrades";
import { filterTradesByStatus } from "../lib/tradeFilters";

export const Route = createFileRoute("/dashboard")({
	component: DashboardPage,
});

function DashboardPage() {
	const filters = useFilterParams();
	const accountId = useFilters((s) => s.accountId);
	const tradeStatusFilter = useFilters((s) => s.tradeStatus);
	const toggleTradeStatus = useFilters((s) => s.toggleTradeStatus);
	const navigate = useNavigate();

	const summaryQ = useSummary(filters);
	const equityQ = useEquityCurve(filters);
	const tradesQ = useTrades(filters);
	const accountsQ = useAccounts();

	const trades = filterTradesByStatus(
		[...(tradesQ.data ?? [])].sort(
			(a, b) =>
				new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime(),
		),
		tradeStatusFilter,
	);

	return (
		<DashboardView
			summaryLoading={summaryQ.isLoading}
			summaryError={summaryQ.isError}
			summary={summaryQ.data}
			equityLoading={equityQ.isLoading}
			equityError={equityQ.isError}
			equityPoints={equityQ.data?.points ?? []}
			tradesLoading={tradesQ.isLoading}
			tradesError={tradesQ.isError}
			trades={trades}
			accounts={accountsQ.data ?? []}
			selectedAccountId={accountId}
			tradeStatusFilter={tradeStatusFilter}
			onToggleTradeStatus={toggleTradeStatus}
			onSelectTrade={(t) =>
				navigate({ to: "/trades/$id", params: { id: t.id } })
			}
		/>
	);
}
