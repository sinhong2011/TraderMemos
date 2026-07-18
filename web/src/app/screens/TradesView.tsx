import { List, Plus, Search, Upload, X } from "lucide-react";
import { Card } from "../../components/Card";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { Page } from "../../components/Page";
import { SignalInput } from "../../components/SignalInput";
import { Skeleton } from "../../components/Skeleton";
import { tradeColumns } from "../../components/tradeColumns";
import { Button } from "../../components/ui/button";
import type { Trade } from "../../lib/api/types";
import { useMoneyFx } from "../../lib/hooks/useMoneyFx";
import type { TradeStatusFilter } from "../../lib/tradeFilters";

export interface TradesViewProps {
  trades: Trade[];
  loading: boolean;
  error: boolean;
  currency: string;
  symbol: string;
  onSymbolChange: (s: string) => void;
  onSelectTrade: (id: string) => void;
  onOpenFullPage: (id: string) => void;
  totalInScope: number;
  scopeLoading: boolean;
  hasNarrowingFilters: boolean;
  tradeStatus?: TradeStatusFilter;
  onToggleTradeStatus?: (filter: TradeStatusFilter) => void;
  onClearFilters: () => void;
  onClearStatus?: () => void;
  onImport: () => void;
  onNewTrade: () => void;
  onRetry?: () => void;
}

const STATUS_LABELS: Record<TradeStatusFilter, string> = {
  win: "Wins",
  loss: "Losses",
  open: "Open",
  wash: "Wash",
};

const STATUS_TOGGLES: TradeStatusFilter[] = ["win", "loss", "open", "wash"];

function FilterChip({ label, onClear }: { label: string; onClear?: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-control bg-bg-hover px-2.5 text-[10px] font-medium text-text-muted">
      {label}
      {onClear ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClear}
          aria-label={`Clear ${label} filter`}
          className="-me-1.5 text-text-dim hover:text-text"
        >
          <X size={10} strokeWidth={2} />
        </Button>
      ) : null}
    </span>
  );
}

function ToolbarButton({
  label,
  icon: Icon,
  onClick,
  variant = "ghost",
}: {
  label: string;
  icon: typeof Plus;
  onClick: () => void;
  variant?: "ghost" | "primary";
}) {
  return (
    <Button
      type="button"
      variant={variant === "primary" ? "soft" : "ghost"}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon size={13} strokeWidth={1.75} />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

export function TradesView({
  trades,
  loading,
  error,
  currency,
  symbol,
  onSymbolChange,
  onSelectTrade,
  onOpenFullPage,
  totalInScope,
  scopeLoading,
  hasNarrowingFilters,
  tradeStatus,
  onToggleTradeStatus,
  onClearFilters,
  onClearStatus,
  onImport,
  onNewTrade,
  onRetry,
}: TradesViewProps) {
  const { currency: displayCurrency, rate } = useMoneyFx(currency);
  const fxRate = rate ?? 1;
  const filteredEmpty = !loading && !error && trades.length === 0;
  const trulyEmpty = filteredEmpty && !scopeLoading && totalInScope === 0 && !hasNarrowingFilters;
  const narrowedEmpty = filteredEmpty && !trulyEmpty && (hasNarrowingFilters || totalInScope > 0);

  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {onToggleTradeStatus
        ? STATUS_TOGGLES.map((status) => (
            <Button
              key={status}
              type="button"
              variant={tradeStatus === status ? "soft" : "ghost"}
              size="sm"
              onClick={() => onToggleTradeStatus(status)}
              className="hidden h-7 text-[10px] sm:inline-flex"
            >
              {STATUS_LABELS[status]}
            </Button>
          ))
        : null}
      {tradeStatus ? (
        <span className="sm:hidden">
          <FilterChip label={STATUS_LABELS[tradeStatus]} onClear={onClearStatus} />
        </span>
      ) : null}
      {symbol ? (
        <FilterChip label={`Symbol: ${symbol}`} onClear={() => onSymbolChange("")} />
      ) : null}
      <div className="relative flex items-center">
        <Search
          size={13}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-2.5 text-text-dim"
          aria-hidden
        />
        <SignalInput
          value={symbol}
          onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
          placeholder="Symbol"
          maxLength={21}
          aria-label="Filter symbol"
          className="h-8 w-[108px] pl-7 text-[11px]"
        />
      </div>
      <span className="text-[11px] tabular-nums text-text-muted">
        {trades.length} {trades.length === 1 ? "trade" : "trades"}
      </span>
      {hasNarrowingFilters ? (
        <Button
          type="button"
          variant="link"
          onClick={onClearFilters}
          className="h-auto rounded-sharp text-[10px] font-medium"
        >
          Clear filters
        </Button>
      ) : null}
      <span aria-hidden className="hidden h-5 w-px bg-border sm:block" />
      <ToolbarButton label="Import CSV" icon={Upload} onClick={onImport} />
      <ToolbarButton label="Log trade" icon={Plus} onClick={onNewTrade} variant="primary" />
    </div>
  );

  const emptyActions = (
    <>
      <Button type="button" variant="ghost" onClick={onImport}>
        <Upload size={13} strokeWidth={1.75} />
        Import CSV
      </Button>
      <Button type="button" variant="soft" onClick={onNewTrade}>
        <Plus size={13} strokeWidth={1.75} />
        Log trade
      </Button>
    </>
  );

  return (
    <Page fill className="min-h-[calc(100dvh-52px)]">
      <Card title="Trade log" action={headerActions} fill flush className="min-h-0">
        <div className="flex min-h-0 flex-1 flex-col">
          {loading ? (
            <Skeleton height="360px" className="m-4" />
          ) : error ? (
            <div className="flex flex-wrap items-center gap-3 p-4">
              <p className="text-xs text-loss">
                Failed to load trades. Check your connection and try again.
              </p>
              {onRetry ? (
                <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
            </div>
          ) : trulyEmpty ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                title="No trades yet"
                hint="Import broker history or log your first trade to start tracking performance."
                icon={<List size={40} strokeWidth={1.5} />}
                actions={emptyActions}
              />
            </div>
          ) : narrowedEmpty ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                title="No trades match these filters"
                hint="Widen the date range, clear the symbol filter, or switch account."
                icon={<Search size={36} strokeWidth={1.5} />}
                actions={
                  hasNarrowingFilters ? (
                    <Button type="button" variant="ghost" onClick={onClearFilters}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1">
              <DataTable
                columns={tradeColumns(
                  displayCurrency,
                  {
                    onOpenDrawer: (t) => onSelectTrade(t.id),
                    onOpenFullPage: (t) => onOpenFullPage(t.id),
                    onFilterSymbol: (s) => onSymbolChange(s),
                  },
                  fxRate,
                )}
                data={trades}
                onRowClick={(t) => onSelectTrade(t.id)}
                maxHeight="100%"
                className="h-full"
              />
            </div>
          )}
        </div>
      </Card>
    </Page>
  );
}
