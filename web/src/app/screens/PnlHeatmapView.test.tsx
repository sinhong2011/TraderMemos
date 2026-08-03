import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "@/lib/api/types";
import { computePnlHeatmap } from "@/lib/pnlHeatmap";
import { PnlHeatmapView } from "./PnlHeatmapView";

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t1",
    account_id: "a1",
    symbol: "NQ",
    instrument_type: "future",
    direction: "long",
    status: "closed",
    opened_at: "2026-01-05T15:30:00Z",
    closed_at: "2026-01-05T16:00:00Z",
    qty_opened: 1,
    qty_remaining: 0,
    avg_entry_price: 100,
    avg_exit_price: 110,
    gross_pnl: 10,
    fees_total: 0,
    net_pnl: 10,
    pnl_currency: "USD",
    return_pct: 0.1,
    time_in_trade_secs: 1800,
    notes: "",
    tags: [],
    ...over,
  };
}

const baseProps = { loading: false, error: false, currency: "USD", fxRate: 1 };

describe("PnlHeatmapView", () => {
  it("renders traded cells with money tooltips", () => {
    const heatmap = computePnlHeatmap(
      [
        trade({ net_pnl: 150 }),
        trade({ id: "2", opened_at: "2026-01-06T15:30:00Z", net_pnl: -60 }),
      ],
      "America/New_York",
    );
    render(<PnlHeatmapView {...baseProps} heatmap={heatmap} />);
    expect(screen.getByText("P&L heatmap")).toBeInTheDocument();
    expect(screen.getByLabelText("Mon 10:00 — +$150.00 · 1 trade")).toBeInTheDocument();
    expect(screen.getByLabelText("Tue 10:00 — -$60.00 · 1 trade")).toBeInTheDocument();
  });

  it("shows an empty state without closed trades", () => {
    const heatmap = computePnlHeatmap([], "America/New_York");
    render(<PnlHeatmapView {...baseProps} heatmap={heatmap} />);
    expect(screen.getByText("No closed trades yet")).toBeInTheDocument();
  });
});
