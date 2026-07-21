import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vite-plus/test";
import type { Summary } from "../lib/api/types";
import {
  ReportsDisplayProvider,
  useReportsMoney,
  type ReportsDisplay,
} from "./ReportsDisplayContext";

function summary(over: Partial<Summary>): Summary {
  return {
    total_trades: 1,
    wins: 1,
    losses: 0,
    breakeven: 0,
    win_rate: 1,
    net_pnl: 0,
    gross_profit: 0,
    gross_loss: 0,
    profit_factor: 0,
    expectancy: 0,
    avg_win: 0,
    avg_loss: 0,
    avg_trade: 0,
    largest_win: 0,
    largest_loss: 0,
    total_fees: 0,
    ...over,
  };
}

function wrapper(value: ReportsDisplay) {
  return ({ children }: { children: ReactNode }) => (
    <ReportsDisplayProvider value={value}>{children}</ReportsDisplayProvider>
  );
}

const s = summary({ net_pnl: 100, gross_profit: 150, gross_loss: 30 }); // gross = 120

describe("useReportsMoney", () => {
  it("net mode returns net_pnl; gross mode returns gross_profit - gross_loss", () => {
    const net = renderHook(() => useReportsMoney(), {
      wrapper: wrapper({
        pnlMode: "net",
        unitMode: "abs",
        denominator: 0,
        currency: "USD",
        fxRate: 1,
      }),
    });
    expect(net.result.current.pnl(s)).toBe(100);
    const gross = renderHook(() => useReportsMoney(), {
      wrapper: wrapper({
        pnlMode: "gross",
        unitMode: "abs",
        denominator: 0,
        currency: "USD",
        fxRate: 1,
      }),
    });
    expect(gross.result.current.pnl(s)).toBe(120);
  });

  it("abs mode formats money; pct mode divides by the denominator", () => {
    const pct = renderHook(() => useReportsMoney(), {
      wrapper: wrapper({
        pnlMode: "net",
        unitMode: "pct",
        denominator: 1000,
        currency: "USD",
        fxRate: 1,
      }),
    });
    expect(pct.result.current.display(100)).toBeCloseTo(0.1); // 100/1000
    expect(pct.result.current.format(100)).toBe(pct.result.current.formatAxis(0.1)); // both render 10%
    expect(pct.result.current.pctEnabled).toBe(true);
  });

  it("pct is disabled (falls back to abs) when denominator is 0", () => {
    const noBasis = renderHook(() => useReportsMoney(), {
      wrapper: wrapper({
        pnlMode: "net",
        unitMode: "pct",
        denominator: 0,
        currency: "USD",
        fxRate: 1,
      }),
    });
    expect(noBasis.result.current.pctEnabled).toBe(false);
    expect(noBasis.result.current.display(100)).toBe(100); // abs fallback, not /0
  });

  it("applies fxRate in abs mode", () => {
    const fx = renderHook(() => useReportsMoney(), {
      wrapper: wrapper({
        pnlMode: "net",
        unitMode: "abs",
        denominator: 0,
        currency: "USD",
        fxRate: 2,
      }),
    });
    expect(fx.result.current.display(100)).toBe(200);
  });
});
