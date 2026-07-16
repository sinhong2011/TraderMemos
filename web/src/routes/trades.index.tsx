import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { TradesView } from "../app/screens/TradesView";
import { TradeDetailSheet } from "../components/TradeDetailSheet";
import { accountBaseCurrency } from "../lib/displayPrefs";
import { useFilterParams, useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useTrades } from "../lib/hooks/useTrades";
import { filterTradesByStatus } from "../lib/tradeFilters";
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
  const toggleTradeStatus = useFilters((s) => s.toggleTradeStatus);
  const navigate = useNavigate();
  const openModal = useUI((s) => s.openModal);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);

  const tradesQ = useTrades(filters);
  const accountsQ = useAccounts();
  const accounts = accountsQ.data ?? [];
  const currency = accountBaseCurrency(accounts, accountId);

  const hasNarrowingFilters = !!(from || to || symbol || tradeStatus);
  const scopeFilters = accountId ? { account_id: accountId } : {};
  const scopeQ = useTrades(scopeFilters);

  const trades = filterTradesByStatus(tradesQ.data ?? [], tradeStatus);

  function handleClearFilters() {
    setSymbol(undefined);
    setRange(undefined, undefined);
    setTradeStatus(undefined);
  }

  return (
    <>
      <TradesView
        trades={trades}
        loading={tradesQ.isLoading}
        error={tradesQ.isError}
        currency={currency}
        symbol={symbol}
        onSymbolChange={(s) => setSymbol(s || undefined)}
        onSelectTrade={(id) => setSelectedTradeId(id)}
        onOpenFullPage={(id) => void navigate({ to: "/trades/$id", params: { id } })}
        totalInScope={scopeQ.data?.length ?? 0}
        scopeLoading={scopeQ.isLoading}
        hasNarrowingFilters={hasNarrowingFilters}
        tradeStatus={tradeStatus}
        onToggleTradeStatus={toggleTradeStatus}
        onClearFilters={handleClearFilters}
        onClearStatus={() => setTradeStatus(undefined)}
        onImport={() => navigate({ to: "/import" })}
        onNewTrade={() => openModal("new-trade")}
        onRetry={() => void tradesQ.refetch()}
      />
      <TradeDetailSheet tradeId={selectedTradeId} onClose={() => setSelectedTradeId(null)} />
    </>
  );
}
