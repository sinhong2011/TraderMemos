import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "../lib/cn";

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  /** Scroll container height — required for virtualization in flex layouts */
  maxHeight?: string | number;
  className?: string;
  dense?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  onRowClick,
  maxHeight = "100%",
  className,
  dense = false,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => (dense ? 36 : 44),
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
        fontSize: dense ? "11px" : "13px",
        maxHeight,
      }}
    >
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-1 bg-bg-panel">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
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
                      "select-none px-3 py-2 font-semibold uppercase tracking-widest text-text-muted",
                      dense ? "text-[10px]" : "text-[10px]",
                      alignRight && "text-right",
                    )}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        title={meta?.headerTitle}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-1 rounded-sharp uppercase tracking-widest hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                          alignRight && "justify-end",
                        )}
                      >
                        {label}
                        <span className="opacity-50 ml-0.5">
                          {sorted === "asc" ? (
                            <ChevronUp size={12} strokeWidth={1.5} />
                          ) : sorted === "desc" ? (
                            <ChevronDown size={12} strokeWidth={1.5} />
                          ) : (
                            <ChevronsUpDown size={12} strokeWidth={1.5} />
                          )}
                        </span>
                      </button>
                    ) : (
                      <span
                        title={meta?.headerTitle}
                        className={cn("flex items-center gap-1", alignRight && "justify-end")}
                      >
                        {label}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
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
                        dense ? "py-2" : "py-2.5",
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
              <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
