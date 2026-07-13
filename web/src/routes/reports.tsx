import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { type BreakdownDim, ReportsView } from "../app/screens/ReportsView";
import { useFilterParams, useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import {
	useBreakdown,
	useEquityCurve,
	useRSummary,
	useSummary,
} from "../lib/hooks/useAnalytics";

export const Route = createFileRoute("/reports")({
	component: ReportsPage,
});

function ReportsPage() {
	const filters = useFilterParams();
	const accountId = useFilters((s) => s.accountId);
	const [dim, setDim] = useState<BreakdownDim>("symbol");
	const [unit, setUnit] = useState<"usd" | "r">("usd");

	const summaryQ = useSummary(filters);
	const rSummaryQ = useRSummary(filters);
	const equityQ = useEquityCurve(filters);
	const breakdownQ = useBreakdown(dim, filters);
	const accountsQ = useAccounts();
	const currency =
		(accountsQ.data ?? []).find((a) => a.id === accountId)?.base_currency ??
		"USD";

	return (
		<ReportsView
			summary={summaryQ.data}
			summaryLoading={summaryQ.isLoading}
			summaryError={summaryQ.isError}
			rSummary={rSummaryQ.data}
			rSummaryLoading={rSummaryQ.isLoading}
			unit={unit}
			onUnitChange={setUnit}
			equity={equityQ.data}
			equityLoading={equityQ.isLoading}
			breakdown={breakdownQ.data ?? []}
			loading={breakdownQ.isLoading}
			error={breakdownQ.isError}
			currency={currency}
			dim={dim}
			onDimChange={setDim}
		/>
	);
}
