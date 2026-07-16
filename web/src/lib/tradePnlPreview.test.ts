import { describe, expect, it } from "vite-plus/test";
import { previewTradePnl } from "./tradePnlPreview";

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
    expect(preview.net).toBeNull();
    expect(preview.feesTotal).toBe(1);
  });
});
