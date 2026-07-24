import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { BreakGroup } from "../lib/api/types";
import { ReportsDisplayProvider } from "./ReportsDisplayContext";
import {
  HeatCell,
  ReportsSymbolHeatmap,
  buildHeatmapNodes,
  tileStyle,
} from "./ReportsSymbolHeatmap";

function grp(key: string, net: number, trades: number): BreakGroup {
  return {
    key,
    summary: {
      total_trades: trades,
      wins: net >= 0 ? trades : 0,
      losses: net < 0 ? trades : 0,
      breakeven: 0,
      win_rate: net >= 0 ? 1 : 0,
      net_pnl: net,
      gross_profit: net > 0 ? net : 0,
      gross_loss: net < 0 ? -net : 0,
      profit_factor: 0,
      expectancy: net,
      avg_win: 0,
      avg_loss: 0,
      avg_trade: net,
      largest_win: 0,
      largest_loss: 0,
      total_fees: 0,
    },
  } as BreakGroup;
}

const props = { loading: false, error: false };

describe("buildHeatmapNodes", () => {
  it("maps symbols to nodes with size=trade count and netPnl", () => {
    expect(buildHeatmapNodes([grp("AAPL", 200, 3), grp("TSLA", -100, 2)])).toEqual([
      { name: "AAPL", size: 3, netPnl: 200 },
      { name: "TSLA", size: 2, netPnl: -100 },
    ]);
  });

  it("excludes symbols with zero trades", () => {
    expect(buildHeatmapNodes([grp("AAPL", 200, 3), grp("MSFT", 0, 0)]).map((n) => n.name)).toEqual([
      "AAPL",
    ]);
  });

  it("uses the given pnlOf callback instead of raw net_pnl", () => {
    const g = grp("AAPL", 100, 3);
    g.summary.gross_profit = 260;
    g.summary.gross_loss = 60; // gross = 200
    expect(
      buildHeatmapNodes([g], (row) => row.summary.gross_profit - row.summary.gross_loss),
    ).toEqual([{ name: "AAPL", size: 3, netPnl: 200 }]);
  });
});

describe("tileStyle", () => {
  it("colors profit green and loss rose", () => {
    expect(tileStyle(50, 100).fill).toBe("var(--profit)");
    expect(tileStyle(-50, 100).fill).toBe("var(--loss)");
  });

  it("scales opacity with magnitude and caps at the max mover", () => {
    expect(tileStyle(100, 100).fillOpacity).toBeGreaterThan(tileStyle(10, 100).fillOpacity);
    expect(tileStyle(100, 100).fillOpacity).toBeCloseTo(0.85);
  });
});

describe("ReportsSymbolHeatmap", () => {
  it("renders the empty state when no symbol has trades", () => {
    render(<ReportsSymbolHeatmap {...props} breakdown={[grp("MSFT", 0, 0)]} />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("shows the card title while loading", () => {
    render(<ReportsSymbolHeatmap {...props} loading breakdown={[]} />);
    expect(screen.getByText("Stock P&L")).toBeInTheDocument();
  });
});

// recharts' Treemap `content` renders zero-size cells in jsdom (no real
// layout), so we render HeatCell directly with explicit width/height instead
// of through the full chart.
describe("HeatCell", () => {
  it("shows the gross P&L when pnlMode is gross", () => {
    render(
      <ReportsDisplayProvider
        value={{ pnlMode: "gross", unitMode: "abs", denominator: 0, currency: "USD", fxRate: 1 }}
      >
        <svg>
          <HeatCell x={0} y={0} width={100} height={100} name="AAPL" netPnl={200} maxAbs={200} />
        </svg>
      </ReportsDisplayProvider>,
    );
    expect(screen.getByText("+$200")).toBeInTheDocument();
  });

  it("shows a percentage of the denominator when unitMode is pct", () => {
    render(
      <ReportsDisplayProvider
        value={{ pnlMode: "net", unitMode: "pct", denominator: 1000, currency: "USD", fxRate: 1 }}
      >
        <svg>
          <HeatCell x={0} y={0} width={100} height={100} name="AAPL" netPnl={250} maxAbs={250} />
        </svg>
      </ReportsDisplayProvider>,
    );
    expect(screen.getByText("25%")).toBeInTheDocument();
  });
});
