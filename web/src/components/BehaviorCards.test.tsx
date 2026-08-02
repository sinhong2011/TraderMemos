import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { BehaviorReport, OutcomeSplit } from "@/lib/api/types";
import { BehaviorLossAversionCard } from "./BehaviorLossAversionCard";
import { BehaviorOverconfidenceCard } from "./BehaviorOverconfidenceCard";
import { BehaviorRevengeCard } from "./BehaviorRevengeCard";

const split = (trades: number, wins: number, netPnl: number): OutcomeSplit => ({
  trades,
  wins,
  win_rate: trades > 0 ? wins / trades : 0,
  net_pnl: netPnl,
});

const emptySection = {
  insufficient_data: false,
  events: [],
  flagged: split(0, 0, 0),
  baseline: split(0, 0, 0),
};

function report(overrides: Partial<BehaviorReport> = {}): BehaviorReport {
  return {
    trades: 25,
    revenge: { ...emptySection },
    overconfidence: { ...emptySection, streaks: 0 },
    loss_aversion: {
      insufficient_data: false,
      avg_win_hold_secs: 0,
      avg_loss_hold_secs: 0,
      median_win_hold_secs: 0,
      median_loss_hold_secs: 0,
      hold_ratio: 0,
      give_backs: [],
      give_back_count: 0,
      missed_profit: 0,
      excluded: 0,
    },
    ...overrides,
  };
}

const props = { loading: false, error: false };

describe("BehaviorRevengeCard", () => {
  it("shows an empty state when nothing is flagged", () => {
    render(<BehaviorRevengeCard {...props} report={report()} />);
    expect(screen.getByText("No revenge patterns detected")).toBeInTheDocument();
  });

  it("renders events with reason pills and opens the trade on click", () => {
    const onSelect = vi.fn();
    const rep = report({
      revenge: {
        insufficient_data: false,
        events: [
          {
            date: "2026-01-05",
            trade_id: "t1",
            symbol: "AAPL",
            trigger_trade_id: "t0",
            reason: "quick_reentry",
            net_pnl: -120,
          },
          {
            date: "2026-01-06",
            trade_id: "t2",
            symbol: "TSLA",
            reason: "size_escalation",
            size_ratio: 2.4,
            net_pnl: 80,
          },
        ],
        flagged: split(2, 1, -40),
        baseline: split(23, 14, 900),
      },
    });
    render(<BehaviorRevengeCard {...props} report={rep} onSelectTradeId={onSelect} />);

    expect(screen.getByText("re-entry")).toBeInTheDocument();
    expect(screen.getByText("size ×2.4")).toBeInTheDocument();
    fireEvent.click(screen.getByText("AAPL"));
    expect(onSelect).toHaveBeenCalledWith("t1");
  });

  it("notes small samples", () => {
    const rep = report({
      revenge: {
        insufficient_data: true,
        events: [
          {
            date: "2026-01-05",
            trade_id: "t1",
            symbol: "AAPL",
            reason: "quick_reentry",
            net_pnl: -10,
          },
        ],
        flagged: split(1, 0, -10),
        baseline: split(2, 1, 20),
      },
    });
    render(<BehaviorRevengeCard {...props} report={rep} />);
    expect(screen.getByText(/Small sample/)).toBeInTheDocument();
  });
});

describe("BehaviorOverconfidenceCard", () => {
  it("acknowledges disciplined streaks in the empty state", () => {
    const rep = report({ overconfidence: { ...emptySection, streaks: 4 } });
    render(<BehaviorOverconfidenceCard {...props} report={rep} />);
    expect(screen.getByText(/4 win streaks of 3\+ found/)).toBeInTheDocument();
  });

  it("renders inflation events with the size ratio", () => {
    const onSelect = vi.fn();
    const rep = report({
      overconfidence: {
        insufficient_data: false,
        streaks: 2,
        events: [
          {
            date: "2026-01-07",
            trade_id: "t9",
            symbol: "NVDA",
            reason: "size_escalation",
            size_ratio: 2,
            net_pnl: -300,
          },
        ],
        flagged: split(1, 0, -300),
        baseline: split(24, 15, 1200),
      },
    });
    render(<BehaviorOverconfidenceCard {...props} report={rep} onSelectTradeId={onSelect} />);

    expect(screen.getByText("size ×2.0")).toBeInTheDocument();
    fireEvent.click(screen.getByText("NVDA"));
    expect(onSelect).toHaveBeenCalledWith("t9");
  });
});

describe("BehaviorLossAversionCard", () => {
  it("shows an empty state without hold or give-back data", () => {
    render(<BehaviorLossAversionCard {...props} report={report()} />);
    expect(screen.getByText("Not enough closed trades yet")).toBeInTheDocument();
  });

  it("renders hold asymmetry, give-backs, and the excluded note", () => {
    const onSelect = vi.fn();
    const rep = report({
      loss_aversion: {
        insufficient_data: false,
        avg_win_hold_secs: 120,
        avg_loss_hold_secs: 600,
        median_win_hold_secs: 100,
        median_loss_hold_secs: 500,
        hold_ratio: 5,
        give_backs: [
          { date: "2026-01-08", trade_id: "gb1", symbol: "MSFT", mfe: 250, net_pnl: -90 },
        ],
        give_back_count: 3,
        missed_profit: 400,
        excluded: 2,
      },
    });
    render(<BehaviorLossAversionCard {...props} report={rep} onSelectTradeId={onSelect} />);

    expect(screen.getByText("5.0×")).toBeInTheDocument();
    expect(screen.getByText(/2 losers without recorded MAE\/MFE/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("MSFT"));
    expect(onSelect).toHaveBeenCalledWith("gb1");
  });

  it("shows loading skeleton", () => {
    const { container } = render(<BehaviorLossAversionCard loading error={false} />);
    expect(container.querySelector("[data-slot=skeleton], .animate-pulse")).toBeTruthy();
  });
});
