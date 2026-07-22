import { describe, expect, it } from "vite-plus/test";
import { aggregateTradePnlPreviews, previewFillNetPnls, previewTradePnl } from "./tradePnlPreview";

describe("previewTradePnl", () => {
  it("computes long stock round-trip net and R", () => {
    const preview = previewTradePnl(
      "long",
      [
        { side: "buy", quantity: 10, price: 100, fees: 0, commission: 1 },
        { side: "sell", quantity: 10, price: 110, fees: 0, commission: 1 },
      ],
      1,
      50,
    );
    expect(preview.closed).toBe(true);
    expect(preview.avgEntry).toBe(100);
    expect(preview.avgExit).toBe(110);
    expect(preview.positionQty).toBe(0);
    expect(preview.gross).toBe(100);
    expect(preview.feesTotal).toBe(2);
    expect(preview.net).toBe(98);
    expect(preview.rMultiple).toBe(1.96);
  });

  it("applies futures multiplier", () => {
    const preview = previewTradePnl(
      "long",
      [
        { side: "buy", quantity: 1, price: 100, fees: 0, commission: 0 },
        { side: "sell", quantity: 1, price: 101, fees: 0, commission: 0 },
      ],
      20,
      20,
    );
    expect(preview.gross).toBe(20);
    expect(preview.net).toBe(20);
    expect(preview.rMultiple).toBe(1);
  });

  it("returns null net for open-only", () => {
    const preview = previewTradePnl(
      "short",
      [{ side: "sell", quantity: 2, price: 50, fees: 1, commission: 0 }],
      1,
      null,
    );
    expect(preview.closed).toBe(false);
    expect(preview.avgEntry).toBe(50);
    expect(preview.avgExit).toBeNull();
    expect(preview.positionQty).toBe(2);
    expect(preview.net).toBeNull();
    expect(preview.feesTotal).toBe(1);
  });

  it("matches option long call round-trip with multiplier", () => {
    const preview = previewTradePnl(
      "long",
      [
        { side: "buy", quantity: 3, price: 2.3, fees: 1.25, commission: 0 },
        { side: "sell", quantity: 2, price: 2.4, fees: 0.85, commission: 0 },
        { side: "sell", quantity: 1, price: 2.5, fees: 1.06, commission: 0 },
      ],
      100,
      null,
    );
    expect(preview.closed).toBe(true);
    expect(preview.avgEntry).toBeCloseTo(2.3);
    expect(preview.avgExit).toBeCloseTo(2.4333, 3);
    expect(preview.positionQty).toBe(0);
    expect(preview.net).toBe(36.84);
  });
});

describe("aggregateTradePnlPreviews", () => {
  it("sums nets, fees, and closed counts across symbols", () => {
    const a = previewTradePnl(
      "long",
      [
        { side: "buy", quantity: 10, price: 100, fees: 0, commission: 1 },
        { side: "sell", quantity: 10, price: 110, fees: 0, commission: 1 },
      ],
      1,
      50,
    );
    const b = previewTradePnl(
      "long",
      [
        { side: "buy", quantity: 5, price: 20, fees: 0, commission: 0.5 },
        { side: "sell", quantity: 5, price: 18, fees: 0, commission: 0.5 },
      ],
      1,
      25,
    );
    const batch = aggregateTradePnlPreviews([
      { preview: a, initialRisk: 50 },
      { preview: b, initialRisk: 25 },
    ]);
    expect(batch.symbolCount).toBe(2);
    expect(batch.withFills).toBe(2);
    expect(batch.closedCount).toBe(2);
    expect(batch.openCount).toBe(0);
    expect(batch.feesTotal).toBe(3);
    expect(batch.net).toBe(87); // 98 + (−11)
    expect(batch.riskTotal).toBe(75);
    expect(batch.rMultiple).toBe(1.16);
  });

  it("returns null net when no symbol is closed", () => {
    const open = previewTradePnl(
      "long",
      [{ side: "buy", quantity: 2, price: 10, fees: 1, commission: 0 }],
      1,
      null,
    );
    const batch = aggregateTradePnlPreviews([{ preview: open }]);
    expect(batch.net).toBeNull();
    expect(batch.openCount).toBe(1);
    expect(batch.closedCount).toBe(0);
    expect(batch.feesTotal).toBe(1);
  });
});

describe("previewFillNetPnls", () => {
  it("allocates entry fees across AAPL option sells", () => {
    const fills = [
      { side: "buy" as const, quantity: 4, price: 0.95, fees: 0.82, commission: 0 },
      { side: "sell" as const, quantity: 2, price: 1.16, fees: 0.42, commission: 0 },
      { side: "sell" as const, quantity: 1, price: 1.5, fees: 0.56, commission: 0 },
      { side: "sell" as const, quantity: 1, price: 1.25, fees: 1.04, commission: 0 },
    ];
    const pnls = previewFillNetPnls("long", fills, 100);
    expect(pnls[0]).toBeNull();
    expect(pnls[1]).toBe(41.17);
    expect(pnls[2]).toBe(54.24);
    expect(pnls[3]).toBe(28.76);
    const sum = (pnls[1] ?? 0) + (pnls[2] ?? 0) + (pnls[3] ?? 0);
    expect(sum).toBeCloseTo(124.17, 2);
  });

  it("matches IBKR FIFO on interleaved TSLA option fills", () => {
    const fills = [
      { side: "buy" as const, quantity: 3, price: 1.95, fees: 2.05, commission: 0 },
      { side: "sell" as const, quantity: 1, price: 2.11, fees: 1.05, commission: 0 },
      { side: "sell" as const, quantity: 1, price: 2.18, fees: 1.06, commission: 0 },
      { side: "buy" as const, quantity: 2, price: 2.3, fees: 1.37, commission: 0 },
      { side: "sell" as const, quantity: 3, price: 2.03, fees: 2.07, commission: 0 },
      { side: "buy" as const, quantity: 3, price: 2.29, fees: 2.05, commission: 0 },
      { side: "sell" as const, quantity: 2, price: 2.45, fees: 0.43, commission: 0 },
    ];
    const pnls = previewFillNetPnls("long", fills, 100);
    expect(pnls).toEqual([null, 14.27, 21.26, null, -50.12, null, 30.2]);
    const preview = previewTradePnl("long", fills, 100, null);
    expect(preview.positionQty).toBe(1);
    expect(preview.closed).toBe(false);
    expect(preview.net).toBe(15.61);
    // Within 1¢ of IBKR row labels (+14.26 / +30.21) — fee pro-rata rounding.
    expect(pnls[1]).toBeCloseTo(14.26, 1);
    expect(pnls[6]).toBeCloseTo(30.21, 1);
  });
});
