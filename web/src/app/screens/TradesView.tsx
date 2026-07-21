import type { SortingState, VisibilityState } from "@tanstack/react-table";
import { List, Plus, Search, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/Card";
import { CreatedAtFilter } from "../../components/CreatedAtFilter";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { FacetedFilter } from "../../components/FacetedFilter";
import { Page } from "../../components/Page";
import { Pagination } from "../../components/Pagination";
import { SignalInput } from "../../components/SignalInput";
import { Skeleton } from "../../components/Skeleton";
import { SortList } from "../../components/SortList";
import {
  TRADE_SORT_COLUMNS,
  TRADE_VIEW_COLUMNS,
  tradeColumns,
} from "../../components/tradeColumns";
import { Button } from "../../components/ui/button";
import { ViewOptions } from "../../components/ViewOptions";
import type { Trade } from "../../lib/api/types";
import { cn } from "../../lib/cn";
import { useMoneyFx } from "../../lib/hooks/useMoneyFx";
import { clampPage, pageCountFor, slicePage } from "../../lib/pagination";
import type { TradeStatusFilter } from "../../lib/tradeFilters";

const DEFAULT_PAGE_SIZE = 20;

function compareSortValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  const left = typeof a === "string" || typeof a === "number" ? String(a) : JSON.stringify(a);
  const right = typeof b === "string" || typeof b === "number" ? String(b) : JSON.stringify(b);
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

/** Apply tablecn-style multi-sort across the full filtered set before pagination. */
export function sortTrades(trades: Trade[], sorting: SortingState): Trade[] {
  if (sorting.length === 0) return trades;
  return [...trades].sort((rowA, rowB) => {
    for (const { id, desc } of sorting) {
      const cmp = compareSortValues(rowA[id as keyof Trade], rowB[id as keyof Trade]);
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
}

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

const STATUS_FACETS = [
  { value: "win", label: "Wins" },
  { value: "loss", label: "Losses" },
  { value: "open", label: "Open" },
  { value: "wash", label: "Wash" },
] as const;

function ToolbarIconButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Plus;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "size-8 pointer-coarse:size-11",
        "border-border !bg-transparent hover:border-border-strong hover:!bg-transparent",
      )}
    >
      <Icon size={14} strokeWidth={1.75} />
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const sortedTrades = useMemo(() => sortTrades(trades, sorting), [trades, sorting]);
  const pageCount = pageCountFor(sortedTrades.length, pageSize);
  const safePage = clampPage(page, pageCount);
  const pageTrades = slicePage(sortedTrades, safePage, pageSize);

  useEffect(() => {
    setPage(1);
  }, [symbol, tradeStatus, pageSize]);

  const filteredEmpty = !loading && !error && trades.length === 0;
  const trulyEmpty = filteredEmpty && !scopeLoading && totalInScope === 0 && !hasNarrowingFilters;
  const narrowedEmpty = filteredEmpty && !trulyEmpty && (hasNarrowingFilters || totalInScope > 0);

  function handleStatusChange(next: string | string[] | undefined) {
    if (!onToggleTradeStatus) return;
    if (next == null || next === "") {
      if (onClearStatus) onClearStatus();
      else if (tradeStatus) onToggleTradeStatus(tradeStatus);
      return;
    }
    const value = Array.isArray(next) ? next[0] : next;
    if (value && value !== tradeStatus) onToggleTradeStatus(value as TradeStatusFilter);
  }

  const toolbarControlClass =
    "border-border !bg-transparent hover:border-border-strong hover:!bg-transparent aria-expanded:border-border-strong aria-expanded:!bg-transparent";

  const headerActions = (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:gap-3">
      <div className="flex flex-wrap items-center gap-2">
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
            placeholder="Filter symbol…"
            maxLength={21}
            aria-label="Filter symbol"
            className={cn(
              "h-8 w-[11.72rem] !border-solid !border !border-border !bg-transparent pl-7 text-[12px]",
              "hover:!border-border-strong hover:!bg-transparent focus-visible:!bg-transparent",
              symbol && "pr-7",
            )}
          />
          {symbol ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Clear symbol filter"
              onClick={() => onSymbolChange("")}
              className="absolute right-1 text-text-dim hover:text-text"
            >
              <X size={12} strokeWidth={2} />
            </Button>
          ) : null}
        </div>
        {onToggleTradeStatus ? (
          <FacetedFilter
            title="Status"
            options={STATUS_FACETS}
            value={tradeStatus}
            onChange={handleStatusChange}
            className={toolbarControlClass}
          />
        ) : null}
        <CreatedAtFilter className={toolbarControlClass} />
        {hasNarrowingFilters ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className={cn("h-8 px-2 text-[12px]", toolbarControlClass)}
          >
            Reset
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <SortList
          sorting={sorting}
          onSortingChange={setSorting}
          columns={TRADE_SORT_COLUMNS}
          className={toolbarControlClass}
        />
        <ViewOptions
          columns={TRADE_VIEW_COLUMNS}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          className={toolbarControlClass}
        />
        <ToolbarIconButton label="Import CSV" icon={Upload} onClick={onImport} />
        <ToolbarIconButton label="Log trade" icon={Plus} onClick={onNewTrade} />
      </div>
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

  const showTable = !loading && !error && !trulyEmpty && !narrowedEmpty;

  return (
    <Page fill className="h-full min-h-0 overflow-hidden bg-transparent">
      {headerActions}
      <Card
        fill
        flush
        className="min-h-0 overflow-hidden border border-border-strong bg-transparent"
      >
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
            <div className="min-h-0 flex-1 overflow-hidden">
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
                data={pageTrades}
                onRowClick={(t) => onSelectTrade(t.id)}
                maxHeight="100%"
                className="h-full"
                comfortable
                lined
                headerClassName="bg-bg"
                sorting={sorting}
                onSortingChange={setSorting}
                enableMultiSort
                columnVisibility={columnVisibility}
                onColumnVisibilityChange={setColumnVisibility}
              />
            </div>
          )}
        </div>
      </Card>
      {showTable ? (
        <Pagination
          page={safePage}
          pageCount={pageCount}
          total={sortedTrades.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          alwaysShow
          className="shrink-0 px-0"
        />
      ) : null}
    </Page>
  );
}
