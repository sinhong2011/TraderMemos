import {
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";
import { cn } from "../lib/cn";
import { ColumnHeader } from "./ColumnHeader";

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  /** Scroll container height — required for virtualization in flex layouts */
  maxHeight?: string | number;
  className?: string;
  dense?: boolean;
  /** Slightly larger type/row height than default (trade log); ~2% over base after density tune) */
  comfortable?: boolean;
  /** Hairline under header and between rows */
  lined?: boolean;
  /** Override sticky header surface (default `bg-bg-panel`) */
  headerClassName?: string;
  /** Controlled sorting (tablecn Sort button / header menu stay in sync) */
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  enableMultiSort?: boolean;
  /** Controlled column visibility (tablecn View / Hide) */
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
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
}: DataTableProps<T>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalVisibility, setInternalVisibility] = useState<VisibilityState>({});
  const sorting = sortingProp ?? internalSorting;
  const setSorting = onSortingChange ?? setInternalSorting;
  const columnVisibility = visibilityProp ?? internalVisibility;
  const setColumnVisibility = onColumnVisibilityChange ?? setInternalVisibility;
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const metrics = tableMetrics(dense, comfortable);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    enableMultiSort,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();
  const visibleColCount = table.getVisibleLeafColumns().length;

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

  return (
    <div
      ref={tableContainerRef}
      className={cn("overflow-auto", className)}
      style={{
        fontSize: `${metrics.fontSize}px`,
        maxHeight,
      }}
    >
      <table className="w-full border-collapse">
        <thead className={cn("sticky top-0 z-1 bg-bg-panel", headerClassName)}>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const meta = header.column.columnDef.meta as
                  | { align?: string; headerTitle?: string }
                  | undefined;
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
                    className={cn(
                      "select-none px-3 text-text-muted",
                      metrics.headerText,
                      metrics.headerPy,
                      lined && "border-b border-border",
                      alignRight && "text-right",
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
                  onRowClick && "cursor-pointer hover:bg-bg-hover",
                )}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => {
                  const align =
                    (cell.column.columnDef.meta as { align?: string } | undefined)?.align ===
                    "right"
                      ? "text-right"
                      : "text-left";
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-3 text-text whitespace-nowrap transition-colors duration-150",
                        metrics.cellPy,
                        lined && "border-b border-border",
                        align,
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
