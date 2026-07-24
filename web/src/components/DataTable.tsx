import {
  type Column,
  type ColumnDef,
  type ColumnPinningState,
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "../lib/cn";
import { ColumnHeader } from "./ColumnHeader";

type ColumnMeta = {
  align?: string;
  headerTitle?: string;
  /** Minimum column width in px (keeps money columns from clipping). */
  minWidth?: number;
};

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  /** Cap scrollport height — container shrinks to content below this, so the H-bar sits under rows. */
  maxHeight?: string | number;
  className?: string;
  dense?: boolean;
  /** Slightly larger type/row height than default (trade log); ~2% over base after density tune) */
  comfortable?: boolean;
  /** Hairline under header and between rows */
  lined?: boolean;
  /**
   * Opaque surface for sticky header + pinned columns (must match the table chrome).
   * Defaults to `bg-card`; pass `bg-background` on void surfaces (e.g. Trades).
   */
  headerClassName?: string;
  /** Controlled sorting (tablecn Sort button / header menu stay in sync) */
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  enableMultiSort?: boolean;
  /** Controlled column visibility (tablecn View / Hide) */
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  /** TanStack column pinning — sticky CSS via getIsPinned / getStart / getAfter. */
  columnPinning?: ColumnPinningState;
  onColumnPinningChange?: OnChangeFn<ColumnPinningState>;
}

function tableMetrics(dense: boolean, comfortable: boolean) {
  if (dense)
    return {
      fontSize: 11,
      rowHeight: 36,
      headerText: "text-[10px] font-semibold tracking-widest",
      headerPy: "py-2",
      cellPy: "py-2",
    };
  if (comfortable)
    return {
      fontSize: 13.26, // 15.6 × 0.85
      rowHeight: 48, // 56 × 0.85
      /** Body-matched type; 44px header on the 4px grid */
      headerText: "h-[44px] font-medium tracking-wide",
      headerPy: "py-0",
      cellPy: "py-2.5",
    };
  return {
    fontSize: 13,
    rowHeight: 44,
    headerText: "text-[10px] font-semibold tracking-widest",
    headerPy: "py-2.5",
    cellPy: "py-2.5",
  };
}

/**
 * Sticky pin styles from TanStack's sticky column-pinning example.
 * Header pins need top:0 + higher z so they stay above body pins while scrolling.
 */
function pinningStyle<T>(
  column: Column<T>,
  kind: "header" | "body",
  pinActive: boolean,
): CSSProperties {
  const isPinned = column.getIsPinned();
  if (!isPinned || !pinActive) return {};

  const isLastLeft = isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRight = isPinned === "right" && column.getIsFirstColumn("right");

  return {
    position: "sticky",
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    top: kind === "header" ? 0 : undefined,
    zIndex: kind === "header" ? 3 : 1,
    // Hairline edge only — heavy drop shadows smear over P&L under the pin.
    boxShadow: isLastLeft
      ? "1px 0 0 0 var(--border)"
      : isFirstRight
        ? "-1px 0 0 0 var(--border)"
        : undefined,
  };
}

function pinningCellClass<T>(
  column: Column<T>,
  kind: "header" | "body",
  pinActive: boolean,
  surfaceClassName: string,
) {
  if (!column.getIsPinned() || !pinActive) return undefined;
  return cn(
    // Opaque so scrolled cells never show through the pin — same token as thead.
    surfaceClassName,
    kind === "body" && "group-hover:bg-accent",
  );
}

export function DataTable<T>({
  columns,
  data,
  onRowClick,
  maxHeight = "100%",
  className,
  dense = false,
  comfortable = false,
  lined = false,
  headerClassName,
  sorting: sortingProp,
  onSortingChange,
  enableMultiSort = false,
  columnVisibility: visibilityProp,
  onColumnVisibilityChange,
  columnPinning: pinningProp,
  onColumnPinningChange,
}: DataTableProps<T>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalVisibility, setInternalVisibility] = useState<VisibilityState>({});
  const [internalPinning, setInternalPinning] = useState<ColumnPinningState>(
    () => pinningProp ?? { left: [], right: [] },
  );
  const sorting = sortingProp ?? internalSorting;
  const setSorting = onSortingChange ?? setInternalSorting;
  const columnVisibility = visibilityProp ?? internalVisibility;
  const setColumnVisibility = onColumnVisibilityChange ?? setInternalVisibility;
  const columnPinning = pinningProp ?? internalPinning;
  const setColumnPinning = onColumnPinningChange ?? setInternalPinning;
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [pinActive, setPinActive] = useState(false);
  const metrics = tableMetrics(dense, comfortable);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnPinning },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    enableMultiSort,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();
  const visibleColCount = table.getVisibleLeafColumns().length;
  const hasPinIntent =
    (columnPinning.left?.length ?? 0) > 0 || (columnPinning.right?.length ?? 0) > 0;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => metrics.rowHeight,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

  // Sticky CSS only while content overflows horizontally — avoids covering P&L when everything fits.
  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el || !hasPinIntent) {
      setPinActive(false);
      return;
    }

    const update = () => {
      const tableEl = el.querySelector("table");
      const contentWidth = tableEl
        ? Math.max(tableEl.scrollWidth, tableEl.offsetWidth)
        : el.scrollWidth;
      setPinActive(contentWidth > el.clientWidth + 1);
    };
    update();
    const raf = requestAnimationFrame(update);

    const ro = new ResizeObserver(update);
    ro.observe(el);
    const tableEl = el.querySelector("table");
    if (tableEl) ro.observe(tableEl);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [data, columns, columnVisibility, comfortable, dense, visibleColCount, hasPinIntent]);

  const headerSurface = headerClassName ?? "bg-card";

  return (
    <div
      ref={tableContainerRef}
      className={cn(
        "min-w-0 max-w-full overflow-x-auto overflow-y-auto overscroll-contain scrollbar-table",
        className,
      )}
      style={{
        fontSize: `${metrics.fontSize}px`,
        maxHeight,
      }}
    >
      {/* separate + spacing 0 required for sticky pin + box-shadow (TanStack sticky pinning). */}
      <table
        className="w-max min-w-full border-separate border-spacing-0"
        style={{ width: "max-content" }}
      >
        <thead className={cn("sticky top-0 z-[2]", headerSurface)}>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                const alignRight = meta?.align === "right";
                const label = header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext());
                return (
                  <th
                    key={header.id}
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                    }
                    style={{
                      ...(meta?.minWidth != null ? { minWidth: meta.minWidth } : {}),
                      ...pinningStyle(header.column, "header", pinActive),
                    }}
                    className={cn(
                      "select-none px-3 text-muted-foreground",
                      metrics.headerText,
                      metrics.headerPy,
                      lined && "border-b border-border",
                      alignRight && "text-right",
                      // Every header cell opaque so body never paints through while scrolling.
                      headerSurface,
                      pinningCellClass(header.column, "header", pinActive, headerSurface),
                    )}
                  >
                    <ColumnHeader
                      column={header.column}
                      title={label}
                      titleAttr={meta?.headerTitle}
                      alignRight={alignRight}
                      comfortable={comfortable}
                    />
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} colSpan={visibleColCount} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <tr
                key={row.id}
                className={cn(
                  "group transition-colors duration-150",
                  onRowClick && "cursor-pointer hover:bg-accent",
                )}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                  const align = meta?.align === "right" ? "text-right" : "text-left";
                  return (
                    <td
                      key={cell.id}
                      style={{
                        ...(meta?.minWidth != null ? { minWidth: meta.minWidth } : {}),
                        ...pinningStyle(cell.column, "body", pinActive),
                      }}
                      className={cn(
                        "px-3 text-foreground whitespace-nowrap transition-colors duration-150",
                        metrics.cellPy,
                        lined && "border-b border-border",
                        align,
                        pinningCellClass(cell.column, "body", pinActive, headerSurface),
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: `${paddingBottom}px` }} colSpan={visibleColCount} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
