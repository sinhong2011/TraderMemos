import { useEffect, useMemo, useState } from "react";
import { Undo2 } from "lucide-react";
import type { ColumnDef, ColumnPinningState, SortingState } from "@/lib/table";
import { cn } from "@/lib/cn";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/Item";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { Pill } from "@/components/Pill";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";
import { outlineSurfaceClass } from "@/components/surface-styles";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import type { Account, ImportBatch } from "@/lib/api/types";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { COMPACT_VIEWPORT, useMediaQuery } from "@/lib/hooks/use-mobile";
import { useDeleteImport, useImports } from "@/lib/hooks/useImports";
import { clampPage, pageCountFor, slicePage } from "@/lib/pagination";
import {
  canRollbackBatch,
  compactSourceLabel,
  filterImportHistory,
  IMPORT_HISTORY_PAGE_SIZE,
  isEmptyFlexSync,
  sourceLabel,
} from "./import-history-groups";
import { SettingsSection } from "./settings-ui";

export const IMPORT_HISTORY_COLUMN_PINNING: ColumnPinningState = { start: [], end: ["actions"] };

function compareSortValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const left = typeof a === "string" || typeof a === "number" ? String(a) : JSON.stringify(a);
  const right = typeof b === "string" || typeof b === "number" ? String(b) : JSON.stringify(b);
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

export function sortImportBatches(
  rows: ImportHistoryRow[],
  sorting: SortingState,
): ImportHistoryRow[] {
  const applied = sorting.length > 0 ? sorting : [{ id: "created_at", desc: true }];
  return [...rows].sort((rowA, rowB) => {
    for (const { id, desc } of applied) {
      const cmp = compareSortValues(
        rowA[id as keyof ImportHistoryRow],
        rowB[id as keyof ImportHistoryRow],
      );
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
}

export type ImportHistoryRow = ImportBatch & {
  account_name: string;
  source_label: string;
  file_label: string;
};

function toRow(batch: ImportBatch, accountName: string): ImportHistoryRow {
  return {
    ...batch,
    account_name: accountName,
    source_label: sourceLabel(batch.source),
    file_label: batch.filename && batch.source !== "ibkr-flex-sync" ? batch.filename : "",
  };
}

function RollbackButton({
  batch,
  accountName,
  compact = false,
}: {
  batch: ImportBatch;
  accountName: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toast = useToastManager();
  const rollback = useDeleteImport();

  function handleRollback() {
    rollback.mutate(batch.id, {
      onSuccess: () => {
        setOpen(false);
        toast.add({ title: "Import rolled back", description: `${batch.row_count} rows removed` });
      },
      onError: (err) =>
        toast.add({
          title: "Could not roll back",
          description: err instanceof Error ? err.message : "Rollback failed",
        }),
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={compact ? "ghost" : "outline"}
        size={compact ? "icon-sm" : "sm"}
        aria-label="Roll back"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          compact
            ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
            : "border-border bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"
        }
      >
        <Undo2 size={compact ? 15 : 13} strokeWidth={1.5} />
        {compact ? null : "Roll back"}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Roll back this import?"
        className="max-w-[min(420px,94vw)]"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRollback}
              disabled={rollback.isPending}
            >
              {rollback.isPending ? "Rolling back…" : "Roll back"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
          The {batch.row_count} execution{batch.row_count === 1 ? "" : "s"} imported into{" "}
          {accountName} by this batch will be deleted and trades regrouped. A later sync can import
          them again.
        </p>
      </Modal>
    </>
  );
}

function StatusCell({ batch }: { batch: ImportBatch }) {
  if (batch.status === "reversed") return <Pill tone="muted">Rolled back</Pill>;
  if (isEmptyFlexSync(batch)) return <span className="text-muted-foreground">Empty</span>;
  return <span className="text-muted-foreground">Imported</span>;
}

function ImportHistoryItem({ batch }: { batch: ImportHistoryRow }) {
  const empty = isEmptyFlexSync(batch);
  const reversed = batch.status === "reversed";
  const rowLabel = batch.row_count === 1 ? "row" : "rows";

  return (
    <Item
      variant="outline"
      size="default"
      className={cn(
        "@container/import-row w-full items-center gap-3 rounded-lg px-3.5 py-3",
        outlineSurfaceClass,
      )}
    >
      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle className="min-w-0 flex-wrap gap-x-1.5 gap-y-1 text-[15px]">
          <span className="font-semibold tracking-tight whitespace-nowrap text-foreground">
            {fmtDate(batch.created_at)}
          </span>
          <Pill className="shrink-0 px-2" tone="muted">
            {compactSourceLabel(batch.source)}
          </Pill>
          {reversed ? (
            <Pill className="shrink-0" tone="muted">
              Rolled back
            </Pill>
          ) : null}
          {empty ? (
            <Pill className="shrink-0" tone="muted">
              Empty
            </Pill>
          ) : null}
        </ItemTitle>
        <p className="m-0 min-w-0 truncate text-[12px] leading-normal text-muted-foreground">
          <span className="tabular-nums">{fmtTime(batch.created_at)}</span>
          <span aria-hidden> · </span>
          {batch.account_name}
          <span aria-hidden> · </span>
          <span
            className={cn(
              "tabular-nums",
              empty || batch.row_count === 0 ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {batch.row_count}
          </span>{" "}
          {rowLabel}
        </p>
        {batch.file_label ? (
          <p
            className="m-0 min-w-0 truncate text-[12px] leading-normal text-muted-foreground"
            title={batch.file_label}
          >
            {batch.file_label}
          </p>
        ) : null}
      </ItemContent>
      {canRollbackBatch(batch) ? (
        <ItemActions className="self-center">
          <RollbackButton batch={batch} accountName={batch.account_name} compact />
        </ItemActions>
      ) : null}
    </Item>
  );
}

export function importHistoryColumns(): ColumnDef<ImportHistoryRow>[] {
  return [
    {
      accessorKey: "created_at",
      header: "Date",
      meta: { label: "Date", minWidth: 168 },
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {fmtDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      accessorKey: "source_label",
      header: "Source",
      meta: { label: "Source", minWidth: 140 },
      cell: ({ row }) => row.original.source_label,
    },
    {
      accessorKey: "account_name",
      header: "Account",
      meta: { label: "Account", minWidth: 96 },
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.account_name}</span>,
    },
    {
      accessorKey: "file_label",
      header: "File",
      meta: { label: "File", minWidth: 140 },
      cell: ({ row }) =>
        row.original.file_label ? (
          <span className="truncate text-muted-foreground" title={row.original.file_label}>
            {row.original.file_label}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "row_count",
      header: "Rows",
      meta: { align: "right", label: "Rows", minWidth: 72 },
      cell: ({ row }) => (
        <span
          className={
            row.original.row_count === 0 ? "tabular-nums text-muted-foreground" : "tabular-nums"
          }
        >
          {row.original.row_count}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { label: "Status", minWidth: 108 },
      cell: ({ row }) => <StatusCell batch={row.original} />,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      meta: { minWidth: 108 },
      cell: ({ row }) =>
        canRollbackBatch(row.original) ? (
          <RollbackButton batch={row.original} accountName={row.original.account_name} />
        ) : null,
    },
  ];
}

/**
 * Import batches as a trades-style table: columns, sort, pagination.
 * Empty scheduled Flex syncs are hidden until turned on.
 */
export function ImportHistorySection({
  accounts,
  accountId,
}: {
  accounts: Account[];
  /** Limit the list to one account (the account detail page). */
  accountId?: string;
}) {
  const importsQuery = useImports();
  const compact = useMediaQuery(COMPACT_VIEWPORT);
  const [showEmpty, setShowEmpty] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(IMPORT_HISTORY_PAGE_SIZE);
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);

  const allBatches = useMemo(
    () =>
      (importsQuery.data ?? [])
        .filter((b) => !accountId || b.account_id === accountId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [importsQuery.data, accountId],
  );
  const emptyCount = allBatches.filter(isEmptyFlexSync).length;
  const rows = useMemo(
    () =>
      filterImportHistory(allBatches, showEmpty).map((batch) =>
        toRow(
          batch,
          accounts.find((account) => account.id === batch.account_id)?.name ?? "Deleted account",
        ),
      ),
    [allBatches, showEmpty, accounts],
  );
  const sorted = useMemo(() => sortImportBatches(rows, sorting), [rows, sorting]);
  const pageCount = pageCountFor(sorted.length, pageSize);
  const safePage = clampPage(page, pageCount);
  const pageRows = slicePage(sorted, safePage, pageSize);
  const columns = useMemo(() => importHistoryColumns(), []);

  useEffect(() => {
    setPage(1);
  }, [showEmpty, pageSize, accountId]);

  const emptyToggle =
    emptyCount > 0 ? (
      <Button
        type="button"
        variant={showEmpty ? "secondary" : "outline"}
        size="sm"
        onClick={() => setShowEmpty((v) => !v)}
      >
        {showEmpty ? "Hide empty syncs" : `Show empty syncs (${emptyCount})`}
      </Button>
    ) : null;

  let body;
  if (importsQuery.isError) {
    body = <EmptyState title="Could not load history" hint="Check the server and try again." />;
  } else if (importsQuery.isLoading && !importsQuery.data) {
    body = <TableSkeleton rows={6} columns={5} />;
  } else if (sorted.length === 0) {
    body = (
      <EmptyState
        title="Nothing imported yet"
        hint={
          emptyCount > 0
            ? `${emptyCount} scheduled sync${emptyCount === 1 ? "" : "s"} ran with no new executions.`
            : "Batches appear here after a sync or file import."
        }
        actions={emptyToggle ?? undefined}
      />
    );
  } else if (compact) {
    body = (
      <ItemGroup className="gap-2">
        {pageRows.map((batch) => (
          <ImportHistoryItem key={batch.id} batch={batch} />
        ))}
      </ItemGroup>
    );
  } else {
    body = (
      <div className="overflow-hidden rounded-lg border border-border">
        <DataTable
          columns={columns}
          data={pageRows}
          comfortable
          lined
          headerClassName="bg-card"
          maxHeight="min(60vh, 560px)"
          sorting={sorting}
          onSortingChange={setSorting}
          columnPinning={IMPORT_HISTORY_COLUMN_PINNING}
        />
      </div>
    );
  }

  const hasRows = sorted.length > 0 && !importsQuery.isError;

  return (
    <SettingsSection
      id="import-history"
      title="Sync & import history"
      description="Imports and scheduled syncs, newest first. Rolling a batch back deletes its executions."
      action={sorted.length > 0 ? emptyToggle : undefined}
    >
      {body}
      {hasRows ? (
        <Pagination
          page={safePage}
          pageCount={pageCount}
          total={sorted.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          alwaysShow
          className="px-0"
        />
      ) : null}
    </SettingsSection>
  );
}
