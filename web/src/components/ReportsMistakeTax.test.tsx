import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import type { MistakeTaxReport, Trade } from "@/lib/api/types";
import { ReportsMistakeTax } from "./ReportsMistakeTax";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const trade = (id: string, symbol: string, net: number) =>
  ({ id, symbol, net_pnl: net, closed_at: "2026-09-15T15:00:00Z" }) as Trade;

const report: MistakeTaxReport = {
  period_net: 1120,
  gross_loss: 4840,
  total_cost: 1840,
  total_cost_r: 9.6,
  r_trades: 14,
  flagged_trades: 19,
  share_of_losses: 0.38,
  lucky_wins: 410,
  net_without: 2960,
  sources: [
    {
      key: "tag:t1",
      kind: "tag",
      label: "Chased",
      trades: 2,
      cost: 920,
      cost_r: 4.8,
      r_trades: 2,
      lucky: 120,
      trade_ids: ["a", "b"],
    },
    {
      key: "rule:over_max_risk",
      kind: "rule",
      label: "Over max risk per trade",
      trades: 1,
      cost: 300,
      cost_r: 0,
      r_trades: 0,
      lucky: 0,
      trade_ids: ["c"],
    },
  ],
  bucket: "week",
  series: [
    { period: "2026-09-07", cost: 900 },
    { period: "2026-09-14", cost: 940 },
  ],
  unreviewed_losses: 1,
  unreviewed_ids: ["d"],
};

const trades = [
  trade("a", "NVDA", -800),
  trade("b", "AAPL", 120),
  trade("c", "TSLA", -300),
  trade("d", "AMD", -50),
];

describe("ReportsMistakeTax", () => {
  it("leads with the cost, its share of losses and the counterfactual", () => {
    render(
      <ReportsMistakeTax
        report={report}
        loading={false}
        error={false}
        trades={trades}
        currency="USD"
        fxRate={1}
      />,
    );
    expect(screen.getByText("$1,840.00")).toBeInTheDocument();
    expect(screen.getByText(/38% of this range's losses · 9\.6R · 19 trades/)).toBeInTheDocument();
    expect(screen.getByText("+$2,960.00")).toBeInTheDocument();
    expect(screen.getAllByText(/won anyway \$120\.00/).length).toBeGreaterThan(0);
  });

  it("expands a reason into its trades and opens one", async () => {
    const onSelect = vi.fn<(id: string) => void>();
    render(
      <ReportsMistakeTax
        report={report}
        loading={false}
        error={false}
        trades={trades}
        currency="USD"
        fxRate={1}
        onSelectTradeId={onSelect}
      />,
    );
    const row = screen.getByRole("button", { name: /Chased/ });
    expect(row).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(screen.getByRole("button", { name: /NVDA/ }));
    expect(onSelect).toHaveBeenCalledWith("a");
    // Collapsing hides the trades again.
    await userEvent.click(row);
    expect(screen.queryByRole("button", { name: /NVDA/ })).not.toBeInTheDocument();
  });

  it("points at unreviewed losers", async () => {
    render(
      <ReportsMistakeTax
        report={report}
        loading={false}
        error={false}
        trades={trades}
        currency="USD"
        fxRate={1}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /1 losing trade has no mistake tag or note — show/ }),
    );
    expect(screen.getByRole("button", { name: /AMD/ })).toBeInTheDocument();
  });

  it("explains how to start when nothing is flagged", () => {
    render(
      <ReportsMistakeTax
        report={{
          ...report,
          flagged_trades: 0,
          total_cost: 0,
          sources: [],
          unreviewed_losses: 0,
          unreviewed_ids: [],
        }}
        loading={false}
        error={false}
        trades={trades}
        currency="USD"
        fxRate={1}
      />,
    );
    expect(screen.getByText("No mistakes logged in this range")).toBeInTheDocument();
  });
});
