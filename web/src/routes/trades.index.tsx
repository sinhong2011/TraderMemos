import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TradesView } from "@/app/screens/TradesView";
import { TradeDetailSheet } from "@/components/TradeDetailSheet";
import { accountBaseCurrency } from "@/lib/displayPrefs";
import { useFilterParams, useFilters } from "@/lib/filters";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useTrades } from "@/lib/hooks/useTrades";
import {
  buildMarketFacetOptions,
  buildSymbolFacetOptions,
  buildTagFacetOptions,
  filterTradesByMarkets,
  filterTradesByStatus,
  filterTradesByTags,
} from "@/lib/tradeFilters";
import { useUI } from "@/lib/ui";

export const Route = createFileRoute("/trades/")({
  component: TradesPage,
});

function TradesPage() {
  const filters = useFilterParams();
  const accountIds = useFilters((s) => s.accountIds);
  const from = useFilters((s) => s.from);
  const to = useFilters((s) => s.to);
  const symbols = useFilters((s) => s.symbols);
  const tradeStatus = useFilters((s) => s.tradeStatus);
  const tagIds = useFilters((s) => s.tagIds);
  const markets = useFilters((s) => s.markets);
  const setSymbols = useFilters((s) => s.setSymbols);
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
  const currency = accountBaseCurrency(accounts, accountIds);

  const hasNarrowingFilters = !!(
    from ||
    to ||
    symbols?.length ||
    tradeStatus ||
    tagIds?.length ||
    markets?.length
  );
  const scopeFilters = accountIds?.length ? { account_id: accountIds.join(",") } : {};
  const scopeQ = useTrades(scopeFilters);

  const rawTrades = tradesQ.data;
  const tagOptions = useMemo(() => buildTagFacetOptions(rawTrades ?? []), [rawTrades]);
  const marketOptions = useMemo(() => buildMarketFacetOptions(rawTrades ?? []), [rawTrades]);
  const symbolOptions = useMemo(() => buildSymbolFacetOptions(scopeQ.data ?? []), [scopeQ.data]);
  const trades = filterTradesByMarkets(
    filterTradesByTags(filterTradesByStatus(rawTrades ?? [], tradeStatus), tagIds),
    markets,
  );

  function handleClearFilters() {
    setSymbols(undefined);
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
        symbols={symbols ?? []}
        onSymbolsChange={setSymbols}
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
        symbolOptions={symbolOptions}
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
