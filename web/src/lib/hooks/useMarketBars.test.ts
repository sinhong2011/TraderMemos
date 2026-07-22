import { describe, expect, it } from "vite-plus/test";
import { chartWindowFromTrade, isChartableSymbol, snapChartTime } from "./useMarketBars";

describe("useMarketBars helpers", () => {
  it("rejects E2E fixture symbols", () => {
    expect(isChartableSymbol("E2E8500")).toBe(false);
    expect(isChartableSymbol("AAPL")).toBe(true);
  });

  it("snaps timestamps to minute boundaries", () => {
    expect(snapChartTime("2026-07-13T15:58:22.745Z")).toBe("2026-07-13T15:58:00.000Z");
  });

  it("uses stable snapped window for open trades", () => {
    const w = chartWindowFromTrade("2026-07-12T03:23:00.000Z", null);
    expect(w.from).toBe("2026-07-12T03:23:00.000Z");
    expect(w.to).toMatch(/:00\.000Z$/);
  });
});
