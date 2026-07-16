import { List, Plus, Search, Upload, X } from "lucide-react";
import { Card } from "../../components/Card";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { Page } from "../../components/Page";
import { SignalInput } from "../../components/SignalInput";
import { Skeleton } from "../../components/Skeleton";
import { tradeColumns } from "../../components/tradeColumns";
import type { Trade } from "../../lib/api/types";
import { cn } from "../../lib/cn";
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
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${label} filter`}
          className="-me-1.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-control text-text-dim transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
        >
          <X size={10} strokeWidth={2} />
        </button>
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
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-control px-3 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        variant === "primary"
          ? "bg-accent-bg text-accent hover:bg-accent-bg/80 hover:text-text"
          : "bg-bg-hover text-text-muted hover:bg-bg-hover/80 hover:text-text",
      )}
    >
      <Icon size={13} strokeWidth={1.75} />
      <span className="hidden sm:inline">{label}</span>
    </button>
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
            <button
              key={status}
              type="button"
              onClick={() => onToggleTradeStatus(status)}
              className={cn(
                "hidden h-7 cursor-pointer rounded-control px-2.5 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex sm:items-center",
                tradeStatus === status
                  ? "bg-accent-bg text-accent"
                  : "bg-bg-hover text-text-muted hover:text-text",
              )}
            >
              {STATUS_LABELS[status]}
            </button>
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
        <button
          type="button"
          onClick={onClearFilters}
          className="cursor-pointer rounded-sharp text-[10px] font-medium text-accent transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Clear filters
        </button>
      ) : null}
      <span aria-hidden className="hidden h-5 w-px bg-border sm:block" />
      <ToolbarButton label="Import CSV" icon={Upload} onClick={onImport} />
      <ToolbarButton label="Log trade" icon={Plus} onClick={onNewTrade} variant="primary" />
    </div>
  );

  const emptyActions = (
    <>
      <button
        type="button"
        onClick={onImport}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-control bg-bg-hover px-3 py-1.5 text-[12px] font-medium text-text-muted transition-colors hover:text-text"
      >
        <Upload size={13} strokeWidth={1.75} />
        Import CSV
      </button>
      <button
        type="button"
        onClick={onNewTrade}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-control bg-accent-bg px-3 py-1.5 text-[12px] font-semibold text-accent transition-colors hover:text-text"
      >
        <Plus size={13} strokeWidth={1.75} />
        Log trade
      </button>
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
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex h-7 cursor-pointer items-center rounded-control bg-bg-hover px-2.5 text-[11px] font-medium text-text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Retry
                </button>
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
                    <button
                      type="button"
                      onClick={onClearFilters}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-control bg-bg-hover px-3 py-1.5 text-[12px] text-text-muted transition-colors hover:text-text"
                    >
                      Clear filters
                    </button>
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
