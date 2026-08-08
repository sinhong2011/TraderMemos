/**
 * v8-shaped adapter over @tanstack/react-table v9.
 *
 * v9 rewrote the architecture (`useTable` + tree-shakable features) and ships
 * a legacy compatibility layer for the v8 API. This module re-exports that
 * layer under the v8 names so call sites keep reading naturally; migrating a
 * table to the idiomatic v9 API later only means dropping this import.
 */
import type {
  CellContext as CellContextV9,
  Column as ColumnV9,
  RowData,
  StockFeatures,
} from "@tanstack/react-table";

export type { RowData } from "@tanstack/react-table";

export {
  getCoreRowModel,
  getSortedRowModel,
  useLegacyTable as useReactTable,
} from "@tanstack/react-table/legacy";
export type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
export { flexRender } from "@tanstack/react-table";
export type {
  ColumnPinningState,
  OnChangeFn,
  SortingState,
  ColumnVisibilityState as VisibilityState,
} from "@tanstack/react-table";

/** v8 signature: the stock feature set is implied. */
export type CellContext<TData extends RowData, TValue = unknown> = CellContextV9<
  StockFeatures,
  TData,
  TValue
>;
export type Column<TData extends RowData, TValue = unknown> = ColumnV9<
  StockFeatures,
  TData,
  TValue
>;
