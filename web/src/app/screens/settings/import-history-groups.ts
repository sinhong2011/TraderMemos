import type { ImportBatch } from "@/lib/api/types";

export const IMPORT_HISTORY_PAGE_SIZE = 20;

/** Scheduled Flex sync that ran but imported nothing. */
export function isEmptyFlexSync(batch: ImportBatch): boolean {
  return batch.source === "ibkr-flex-sync" && batch.row_count === 0 && batch.status !== "reversed";
}

export function canRollbackBatch(batch: ImportBatch): boolean {
  return batch.status !== "reversed" && batch.row_count > 0;
}

export function sourceLabel(source: string): string {
  if (source === "ibkr-flex-sync") return "IBKR Flex sync";
  if (source === "csv" || source === "json" || source === "file") return "File import";
  return source;
}

/** Short chip on the compact list, where the full source name is the whole title. */
export function compactSourceLabel(source: string): string {
  if (source === "ibkr-flex-sync") return "Flex";
  if (source === "csv" || source === "json" || source === "file") return "File";
  return source;
}

/** Hide empty Flex heartbeats unless the table is asked to show them. */
export function filterImportHistory(batches: ImportBatch[], showEmpty: boolean): ImportBatch[] {
  if (showEmpty) return batches;
  return batches.filter((batch) => !isEmptyFlexSync(batch));
}
