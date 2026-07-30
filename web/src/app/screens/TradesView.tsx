import type { SortingState, VisibilityState } from "@tanstack/react-table";
import { List, Plus, Search, Upload } from "lucide-react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/Card";
import { CreatedAtFilter } from "@/components/CreatedAtFilter";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ItemGroup } from "@/components/Item";
import { Page } from "@/components/Page";
import { Pagination } from "@/components/Pagination";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";
import { SortList } from "@/components/SortList";
import {
  TRADE_COLUMN_PINNING,
  TRADE_SORT_COLUMNS,
  TRADE_VIEW_COLUMNS,
  tradeColumns,
} from "@/components/tradeColumns";
import { TradeListItem } from "@/components/TradeListItem";
import { TradesFilters } from "@/components/TradesFilters";
import { Button } from "@/components/ui/button";
import { ViewOptions } from "@/components/ViewOptions";
import type { Trade } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { COMPACT_VIEWPORT, useMediaQuery } from "@/lib/hooks/use-mobile";
import { useMoneyFx } from "@/lib/hooks/useMoneyFx";
import { clampPage, pageCountFor, slicePage } from "@/lib/pagination";
import type {
  MarketFacetOption,
  SymbolFacetOption,
  TagFacetOption,
  TradeStatusFilter,
} from "@/lib/tradeFilters";

const DEFAULT_PAGE_SIZE = 20;
/**
 * Starting guess for a compact list row incl. its gap; real heights replace it
 * as rows mount. Close to the measured ~92px so the scrollbar barely shifts.
 */
const LIST_ROW_ESTIMATE = 146;

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
  symbols: string[];
  onSymbolsChange: (symbols?: string[]) => void;
  onSelectTrade: (id: string) => void;
  onOpenFullPage: (id: string) => void;
  onDeleted?: (id: string) => void;
  totalInScope: number;
  scopeLoading: boolean;
  hasNarrowingFilters: boolean;
  tradeStatus?: TradeStatusFilter;
  onToggleTradeStatus?: (filter: TradeStatusFilter) => void;
  tagIds?: string[];
  tagOptions?: TagFacetOption[];
  onTagIdsChange?: (ids?: string[]) => void;
  markets?: string[];
  marketOptions?: MarketFacetOption[];
  onMarketsChange?: (markets?: string[]) => void;
  symbolOptions?: SymbolFacetOption[];
  onClearFilters: () => void;
  onClearStatus?: () => void;
  onImport: () => void;
  onNewTrade: () => void;
  onRetry?: () => void;
}

export function TradesView({
  trades,
  loading,
  error,
  currency,
  symbols,
  onSymbolsChange,
  onSelectTrade,
  onOpenFullPage,
  onDeleted,
  totalInScope,
  scopeLoading,
  hasNarrowingFilters,
  tradeStatus,
  onToggleTradeStatus,
  tagIds,
  tagOptions,
  onTagIdsChange,
  markets,
  marketOptions,
  onMarketsChange,
  symbolOptions = [],
  onClearFilters,
  onClearStatus,
  onImport,
  onNewTrade,
  onRetry,
}: TradesViewProps) {
  const { currency: displayCurrency, rate } = useMoneyFx(currency);
  const fxRate = rate ?? 1;
  const compact = useMediaQuery(COMPACT_VIEWPORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const listStartRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const sortedTrades = useMemo(() => sortTrades(trades, sorting), [trades, sorting]);
  const pageCount = pageCountFor(sortedTrades.length, pageSize);
  const safePage = clampPage(page, pageCount);
  const pageTrades = slicePage(sortedTrades, safePage, pageSize);

  // The compact list scrolls through the whole filtered set instead of paging.
  // Virtualized like DataTable, so a 2000-trade month costs the same DOM as 40.
  // Compact is phone-only, where the document is the scroller, so the list's
  // offset from the top of the page becomes the virtualizer's scrollMargin.
  const listVirtualizer = useWindowVirtualizer({
    count: compact ? sortedTrades.length : 0,
    estimateSize: () => LIST_ROW_ESTIMATE,
    overscan: 8,
    scrollMargin,
  });

  useLayoutEffect(() => {
    const el = listStartRef.current;
    if (!compact || !el) return;

    const measure = () => {
      setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
    };
    measure();

    // The toolbar above the list changes height when filter chips wrap.
    const observer = new ResizeObserver(measure);
    if (el.parentElement) observer.observe(el.parentElement);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [compact, hasNarrowingFilters]);

  useEffect(() => {
    setPage(1);
  }, [symbols, tradeStatus, tagIds, markets, pageSize]);

  const filteredEmpty = !loading && !error && trades.length === 0;
  const trulyEmpty = filteredEmpty && !scopeLoading && totalInScope === 0 && !hasNarrowingFilters;
  const narrowedEmpty = filteredEmpty && !trulyEmpty && (hasNarrowingFilters || totalInScope > 0);
  const hasRows = !loading && !error && !trulyEmpty && !narrowedEmpty;

  // Phone gets `sm` sizing: coss steps controls up to h-9/16px text on coarse
  // pointers, which made these chips heavier than the rows beneath them.
  // Desktop keeps the h-8/14px it has always had.
  const toolbarControlClass =
    "h-8 gap-1.5 px-2.5 text-[13px] sm:text-sm border-border !bg-transparent hover:border-border hover:!bg-transparent aria-expanded:border-border aria-expanded:!bg-transparent";

  const headerActions = (
    // Compact: icon-only controls and the record count share one row. ≥md the
    // labels return and the count moves to the pagination footer.
    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3 md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <TradesFilters
          triggerClassName={toolbarControlClass}
          iconOnly={compact}
          symbols={symbols}
          onSymbolsChange={onSymbolsChange}
          symbolOptions={symbolOptions}
          tradeStatus={tradeStatus}
          onToggleTradeStatus={onToggleTradeStatus}
          onClearStatus={onClearStatus}
          markets={markets}
          marketOptions={marketOptions}
          onMarketsChange={onMarketsChange}
          tagIds={tagIds}
          tagOptions={tagOptions}
          onTagIdsChange={onTagIdsChange}
        />
        <CreatedAtFilter className={toolbarControlClass} iconOnly={compact} />
        {hasNarrowingFilters ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className={cn("px-2 text-[12px]", toolbarControlClass)}
          >
            Reset
          </Button>
        ) : null}
      </div>

      <div className="flex flex-1 items-center gap-2 md:flex-none md:justify-end">
        <SortList
          iconOnly={compact}
          sorting={sorting}
          onSortingChange={setSorting}
          columns={TRADE_SORT_COLUMNS}
          className={toolbarControlClass}
        />
        {/* Column visibility has nothing to toggle in the list view, so this
            follows the view mode (md) rather than the toolbar's wrap width. */}
        <ViewOptions
          columns={TRADE_VIEW_COLUMNS}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          className={cn("hidden md:inline-flex", toolbarControlClass)}
        />
        {compact && hasRows ? (
          <span className="ms-auto text-[11px] tabular-nums text-muted-foreground">
            {sortedTrades.length} {sortedTrades.length === 1 ? "trade" : "trades"}
          </span>
        ) : null}
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

  const body = loading ? (
    <TableSkeleton rows={8} columns={5} className="m-2" />
  ) : error ? (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <p className="text-xs text-destructive">
        Failed to load trades. Check your connection and try again.
      </p>
      {onRetry ? (
        <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  ) : trulyEmpty ? (
    <div className="flex flex-1 items-center justify-center py-10">
      <EmptyState
        title="No trades yet"
        hint="Import broker history or log your first trade to start tracking performance."
        icon={<List size={40} strokeWidth={1.5} />}
        actions={emptyActions}
      />
    </div>
  ) : narrowedEmpty ? (
    <div className="flex flex-1 items-center justify-center py-10">
      <EmptyState
        title="No trades match these filters"
        hint="Widen the date range, clear symbol/status/market/tags filters, or switch account."
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
  ) : // Phone: one row per trade — the 19-column table can't fit. Tap opens the
  // detail drawer for everything the row omits. Rendered instead of the table
  // (not CSS-hidden) so rows and row menus mount once.
  compact ? (
    <div ref={listStartRef}>
      <ItemGroup className="relative block" style={{ height: listVirtualizer.getTotalSize() }}>
        {listVirtualizer.getVirtualItems().map((row) => {
          const trade = sortedTrades[row.index];
          return (
            <div
              key={trade.id}
              data-index={row.index}
              // Rows vary in height (a cramped row wraps), so let the
              // virtualizer measure each one rather than trusting the estimate.
              ref={listVirtualizer.measureElement}
              className="absolute inset-x-0 top-0 pb-2"
              style={{
                transform: `translateY(${row.start - listVirtualizer.options.scrollMargin}px)`,
              }}
            >
              <TradeListItem
                trade={trade}
                currency={displayCurrency}
                fxRate={fxRate}
                showDate
                onSelect={(t) => onSelectTrade(t.id)}
              />
            </div>
          );
        })}
      </ItemGroup>
    </div>
  ) : (
    <div className="min-h-0 flex-1 overflow-hidden">
      <DataTable
        columns={tradeColumns(
          displayCurrency,
          {
            onOpenDrawer: (t) => onSelectTrade(t.id),
            onOpenFullPage: (t) => onOpenFullPage(t.id),
            onFilterSymbol: (s) => onSymbolsChange([s]),
            onDeleted: onDeleted ? (t) => onDeleted(t.id) : undefined,
          },
          fxRate,
        )}
        data={pageTrades}
        onRowClick={(t) => onSelectTrade(t.id)}
        maxHeight="100%"
        comfortable
        lined
        headerClassName="bg-background"
        sorting={sorting}
        onSortingChange={setSorting}
        enableMultiSort
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        columnPinning={TRADE_COLUMN_PINNING}
      />
    </div>
  );

  // Compact rides the shell's <main> scroller like the dashboard: no inner
  // scroll box, toolbar pinned to the top of the page as it goes.
  if (compact) {
    return (
      <Page className="gap-0 p-0 pb-2">
        <div className="sticky top-0 z-[1] bg-background px-4 pt-4 pb-2">{headerActions}</div>
        <div className="px-4">{body}</div>
      </Page>
    );
  }

  return (
    <Page fill className="h-full min-h-0 overflow-hidden bg-transparent">
      {headerActions}
      <Card fill flush className="min-h-0 overflow-hidden border border-border bg-transparent">
        <div className="flex min-h-0 flex-1 flex-col">{body}</div>
      </Card>
      {hasRows ? (
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
