import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { EdgeScore } from "@/lib/api/types";
import { ReportsEdgeScore } from "./ReportsEdgeScore";

function edge(overrides: Partial<EdgeScore> = {}): EdgeScore {
  return {
    version: 1,
    score: 85.21,
    components: {
      win_rate: 100,
      profit_factor: 100,
      payoff: 80,
      drawdown: 69.24,
      recovery: 100,
      consistency: 58.82,
    },
    weights: {
      win_rate: 15,
      profit_factor: 25,
      payoff: 20,
      drawdown: 15,
      recovery: 10,
      consistency: 15,
    },
    inputs: {
      win_rate: 0.6,
      profit_factor: 3,
      payoff: 2,
      max_drawdown: 100,
      max_drawdown_pct: 0.0769,
      recovery_factor: 4,
      best_day_share: 0.5,
    },
    closed_trades: 5,
    min_trades: 5,
    ...overrides,
  };
}

describe("ReportsEdgeScore", () => {
  it("shows the rounded composite and each component's raw input", () => {
    render(<ReportsEdgeScore edge={edge()} loading={false} error={false} />);
    expect(screen.getByTestId("edge-score-value").textContent).toBe("85");
    expect(screen.getByText("2.00 : 1")).toBeTruthy();
    expect(screen.getByText("8% of capital")).toBeTruthy();
    expect(screen.getByText("Best day 50%")).toBeTruthy();
    expect(screen.getByText("Full marks: 3.0")).toBeTruthy();
  });

  it("names undefined inputs instead of showing a placeholder", () => {
    render(
      <ReportsEdgeScore
        edge={edge({
          inputs: {
            win_rate: 1,
            profit_factor: null,
            payoff: null,
            max_drawdown: 0,
            max_drawdown_pct: null,
            recovery_factor: null,
            best_day_share: 0.2,
          },
        })}
        loading={false}
        error={false}
      />,
    );
    expect(screen.getAllByText("No losses")).toHaveLength(2);
    expect(screen.getByText("No deposits")).toBeTruthy();
    expect(screen.getByText("No drawdown")).toBeTruthy();
  });

  it("asks for more trades below the minimum", () => {
    render(
      <ReportsEdgeScore
        edge={edge({ score: null, closed_trades: 3 })}
        loading={false}
        error={false}
      />,
    );
    expect(screen.getByText("Not enough trades to score")).toBeTruthy();
    expect(screen.queryByTestId("edge-score-value")).toBeNull();
  });
});
