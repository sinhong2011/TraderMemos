import { describe, expect, it } from "vite-plus/test";
import type { ImportBatch } from "@/lib/api/types";
import {
  canRollbackBatch,
  compactSourceLabel,
  filterImportHistory,
  isEmptyFlexSync,
  sourceLabel,
} from "./import-history-groups";

function batch(partial: Partial<ImportBatch> & Pick<ImportBatch, "id">): ImportBatch {
  return {
    user_id: "u1",
    account_id: "a1",
    source: "ibkr-flex-sync",
    filename: null,
    column_mapping: null,
    row_count: 0,
    status: "committed",
    created_at: "2026-08-24T07:15:20Z",
    ...partial,
  };
}

describe("isEmptyFlexSync", () => {
  it("matches committed Flex syncs with no rows", () => {
    expect(isEmptyFlexSync(batch({ id: "1" }))).toBe(true);
  });

  it("ignores file imports, non-empty syncs, and rolled-back batches", () => {
    expect(isEmptyFlexSync(batch({ id: "1", source: "csv" }))).toBe(false);
    expect(isEmptyFlexSync(batch({ id: "2", row_count: 4 }))).toBe(false);
    expect(isEmptyFlexSync(batch({ id: "3", status: "reversed" }))).toBe(false);
  });
});

describe("canRollbackBatch", () => {
  it("allows rollback only when the batch still owns executions", () => {
    expect(canRollbackBatch(batch({ id: "1", row_count: 4 }))).toBe(true);
    expect(canRollbackBatch(batch({ id: "2", row_count: 0 }))).toBe(false);
    expect(canRollbackBatch(batch({ id: "3", row_count: 4, status: "reversed" }))).toBe(false);
  });
});

describe("sourceLabel", () => {
  it("names known sources", () => {
    expect(sourceLabel("ibkr-flex-sync")).toBe("IBKR Flex sync");
    expect(sourceLabel("json")).toBe("File import");
  });
});

describe("compactSourceLabel", () => {
  it("shortens known sources for chips", () => {
    expect(compactSourceLabel("ibkr-flex-sync")).toBe("Flex");
    expect(compactSourceLabel("csv")).toBe("File");
  });
});

describe("filterImportHistory", () => {
  it("hides empty Flex syncs by default", () => {
    const empty = batch({ id: "e" });
    const data = batch({ id: "d", row_count: 53 });
    const file = batch({ id: "f", source: "csv", filename: "fills.csv", row_count: 10 });
    expect(filterImportHistory([empty, data, file], false)).toEqual([data, file]);
  });

  it("keeps empty Flex syncs when asked", () => {
    const empty = batch({ id: "e" });
    const data = batch({ id: "d", row_count: 4 });
    expect(filterImportHistory([empty, data], true)).toEqual([empty, data]);
  });
});
