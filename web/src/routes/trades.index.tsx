import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TradesView } from "../app/screens/TradesView";
import { useTrades } from "../lib/hooks/useTrades";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useFilterParams, useFilters } from "../lib/filters";

export const Route = createFileRoute("/trades/")({
  component: TradesPage,
});

function TradesPage() {
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);
  const symbol = useFilters((s) => s.symbol) ?? "";
  const setSymbol = useFilters((s) => s.setSymbol);
  const navigate = useNavigate();

  const tradesQ = useTrades(filters);
  const accountsQ = useAccounts();
  const currency =
    (accountsQ.data ?? []).find((a) => a.id === accountId)?.base_currency ?? "USD";

  return (
    <TradesView
      trades={tradesQ.data ?? []}
      loading={tradesQ.isLoading}
      error={tradesQ.isError}
      currency={currency}
      symbol={symbol}
      onSymbolChange={(s) => setSymbol(s || undefined)}
      onSelectTrade={(id) => navigate({ to: "/trades/$id", params: { id } })}
    />
  );
}
