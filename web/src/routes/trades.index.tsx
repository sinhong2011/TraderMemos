import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TradesView } from "../app/screens/TradesView";
import { useFilterParams, useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useTrades } from "../lib/hooks/useTrades";
import { useUI } from "../lib/ui";

export const Route = createFileRoute("/trades/")({
  component: TradesPage,
});

function TradesPage() {
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);
  const from = useFilters((s) => s.from);
  const to = useFilters((s) => s.to);
  const symbol = useFilters((s) => s.symbol) ?? "";
  const tradeStatus = useFilters((s) => s.tradeStatus);
  const setSymbol = useFilters((s) => s.setSymbol);
  const setRange = useFilters((s) => s.setRange);
  const setTradeStatus = useFilters((s) => s.setTradeStatus);
  const navigate = useNavigate();
  const openModal = useUI((s) => s.openModal);

  const tradesQ = useTrades(filters);
  const accountsQ = useAccounts();
  const accounts = accountsQ.data ?? [];
  const currency = accounts.find((a) => a.id === accountId)?.base_currency ?? "USD";

  const hasNarrowingFilters = !!(from || to || symbol || tradeStatus);
  const scopeFilters = accountId ? { account_id: accountId } : {};
  const scopeQ = useTrades(scopeFilters);

  function handleClearFilters() {
    setSymbol(undefined);
    setRange(undefined, undefined);
    setTradeStatus(undefined);
  }

  return (
    <TradesView
      trades={tradesQ.data ?? []}
      loading={tradesQ.isLoading}
      error={tradesQ.isError}
      currency={currency}
      symbol={symbol}
      onSymbolChange={(s) => setSymbol(s || undefined)}
      onSelectTrade={(id) => navigate({ to: "/trades/$id", params: { id } })}
      totalInScope={scopeQ.data?.length ?? 0}
      scopeLoading={scopeQ.isLoading}
      hasNarrowingFilters={hasNarrowingFilters}
      tradeStatus={tradeStatus}
      onClearFilters={handleClearFilters}
      onClearStatus={() => setTradeStatus(undefined)}
      onImport={() => navigate({ to: "/import" })}
      onNewTrade={() => openModal("new-trade")}
      onRetry={() => void tradesQ.refetch()}
    />
  );
}
