import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { type BreakdownDim, ReportsView } from "../app/screens/ReportsView";
import { useFilterParams, useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useBreakdown } from "../lib/hooks/useAnalytics";

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
		(accountsQ.data ?? []).find((a) => a.id === accountId)?.base_currency ??
		"USD";

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
