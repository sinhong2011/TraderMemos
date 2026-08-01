import { beforeEach, describe, expect, it } from "vite-plus/test";
import { normalizeFilterDate, useFilters } from "./filters";

describe("filter store", () => {
  beforeEach(() => useFilters.getState().reset());
  it("sets account and date range and serializes to query params", () => {
    useFilters.getState().setAccount("acc1");
    useFilters.getState().setRange("2026-06-01T00:00:00Z", "2026-06-30T00:00:00Z");
    const p = useFilters.getState().toParams();
    expect(p.account_id).toBe("acc1");
    expect(p.from).toBe("2026-06-01T00:00:00Z");
  });

  it("stores multi-select tag ids and clears them on reset", () => {
    useFilters.getState().setTagIds(["a", "b"]);
    expect(useFilters.getState().tagIds).toEqual(["a", "b"]);
    useFilters.getState().setTagIds([]);
    expect(useFilters.getState().tagIds).toBeUndefined();
    useFilters.getState().setTagIds(["a"]);
    useFilters.getState().reset();
    expect(useFilters.getState().tagIds).toBeUndefined();
  });

  it("stores multi-select markets and clears them on reset", () => {
    useFilters.getState().setMarkets(["stock", "option"]);
    expect(useFilters.getState().markets).toEqual(["stock", "option"]);
    useFilters.getState().reset();
    expect(useFilters.getState().markets).toBeUndefined();
  });

  it("stores multi-select symbols and serializes to comma param", () => {
    useFilters.getState().setSymbols(["AAPL", "MSFT"]);
    expect(useFilters.getState().symbols).toEqual(["AAPL", "MSFT"]);
    expect(useFilters.getState().toParams().symbol).toBe("AAPL,MSFT");
    useFilters.getState().setSymbol("NVDA");
    expect(useFilters.getState().symbols).toEqual(["NVDA"]);
    useFilters.getState().setSymbol(undefined);
    expect(useFilters.getState().symbols).toBeUndefined();
  });

  it("normalizes date-only filter values to RFC3339 in the given timezone", () => {
    expect(normalizeFilterDate("2026-06-01", "start", "UTC")).toBe("2026-06-01T00:00:00Z");
    expect(normalizeFilterDate("2026-06-30", "end", "UTC")).toBe("2026-06-30T23:59:59Z");
    // June = EDT; day boundaries carry the trader's offset.
    expect(normalizeFilterDate("2026-06-01", "start", "America/New_York")).toBe(
      "2026-06-01T00:00:00-04:00",
    );
    expect(normalizeFilterDate("2026-01-15", "end", "America/New_York")).toBe(
      "2026-01-15T23:59:59-05:00",
    );
    expect(normalizeFilterDate("2026-06-01", "start", "Asia/Hong_Kong")).toBe(
      "2026-06-01T00:00:00+08:00",
    );
    // Already-normalized values pass through untouched.
    expect(normalizeFilterDate("2026-06-01T00:00:00Z", "start", "Asia/Hong_Kong")).toBe(
      "2026-06-01T00:00:00Z",
    );
  });

  it("defaults day boundaries to the display timezone preference (Eastern)", () => {
    expect(normalizeFilterDate("2026-06-01", "start")).toBe("2026-06-01T00:00:00-04:00");
  });
});
