import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TradesView } from "../app/screens/TradesView";
import { TradeDetailSheet } from "../components/TradeDetailSheet";
import { accountBaseCurrency } from "../lib/displayPrefs";
import { useFilterParams, useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useTrades } from "../lib/hooks/useTrades";
import {
  buildMarketFacetOptions,
  buildTagFacetOptions,
  filterTradesByMarkets,
  filterTradesByStatus,
  filterTradesByTags,
} from "../lib/tradeFilters";
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
  const tagIds = useFilters((s) => s.tagIds);
  const markets = useFilters((s) => s.markets);
  const setSymbol = useFilters((s) => s.setSymbol);
  const setRange = useFilters((s) => s.setRange);
  const setTradeStatus = useFilters((s) => s.setTradeStatus);
  const toggleTradeStatus = useFilters((s) => s.toggleTradeStatus);
  const setTagIds = useFilters((s) => s.setTagIds);
  const setMarkets = useFilters((s) => s.setMarkets);
  const navigate = useNavigate();
  const openModal = useUI((s) => s.openModal);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);

  const tradesQ = useTrades(filters);
  const accountsQ = useAccounts();
  const accounts = accountsQ.data ?? [];
  const currency = accountBaseCurrency(accounts, accountId);

  const hasNarrowingFilters = !!(
    from ||
    to ||
    symbol ||
    tradeStatus ||
    tagIds?.length ||
    markets?.length
  );
  const scopeFilters = accountId ? { account_id: accountId } : {};
  const scopeQ = useTrades(scopeFilters);

  const rawTrades = tradesQ.data ?? [];
  const tagOptions = useMemo(() => buildTagFacetOptions(rawTrades), [rawTrades]);
  const marketOptions = useMemo(() => buildMarketFacetOptions(rawTrades), [rawTrades]);
  const trades = filterTradesByMarkets(
    filterTradesByTags(filterTradesByStatus(rawTrades, tradeStatus), tagIds),
    markets,
  );

  function handleClearFilters() {
    setSymbol(undefined);
    setRange(undefined, undefined);
    setTradeStatus(undefined);
    setTagIds(undefined);
    setMarkets(undefined);
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
        onDeleted={(id) => {
          if (selectedTradeId === id) setSelectedTradeId(null);
        }}
        totalInScope={scopeQ.data?.length ?? 0}
        scopeLoading={scopeQ.isLoading}
        hasNarrowingFilters={hasNarrowingFilters}
        tradeStatus={tradeStatus}
        onToggleTradeStatus={toggleTradeStatus}
        tagIds={tagIds}
        tagOptions={tagOptions}
        onTagIdsChange={setTagIds}
        markets={markets}
        marketOptions={marketOptions}
        onMarketsChange={setMarkets}
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
