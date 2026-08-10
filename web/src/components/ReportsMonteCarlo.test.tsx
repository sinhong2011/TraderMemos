import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { MonteCarloResult } from "@/lib/api/types";
import { ReportsMonteCarlo } from "./ReportsMonteCarlo";

function simulation(over: Partial<MonteCarloResult> = {}): MonteCarloResult {
  return {
    insufficient_data: false,
    trades: 40,
    paths: 10000,
    horizon: 40,
    seed: 0,
    steps: [
      { n: 20, p05: -100, p25: 50, p50: 200, p75: 380, p95: 600 },
      { n: 40, p05: -150, p25: 120, p50: 420, p75: 750, p95: 1200 },
    ],
    terminal: {
      p05: -150,
      p25: 120,
      p50: 420,
      p75: 750,
      p95: 1200,
      mean: 430,
      prob_negative: 0.08,
    },
    max_drawdown: { p50: 200, p90: 380, p95: 450, p99: 600, worst: 800 },
    sample_paths: [
      [180, 390],
      [-40, 210],
    ],
    risk_of_ruin: 0.03,
    ruin_threshold: 500,
    historical_max_drawdown: 500,
    ...over,
  };
}

describe("ReportsMonteCarlo", () => {
  it("shows an empty state when the sample is too small", () => {
    render(
      <ReportsMonteCarlo
        simulation={simulation({ insufficient_data: true, trades: 4 })}
        loading={false}
        error={false}
        currency="USD"
      />,
    );
    expect(screen.getByText("Not enough closed trades")).toBeInTheDocument();
  });

  it("renders outcome tiles and the i.i.d. caveat", () => {
    render(
      <ReportsMonteCarlo simulation={simulation()} loading={false} error={false} currency="USD" />,
    );
    expect(screen.getByText("Median Outcome")).toBeInTheDocument();
    expect(screen.getByText("Best Case")).toBeInTheDocument();
    expect(screen.getByText("Worst Case")).toBeInTheDocument();
    expect(screen.getByText("Typical Max Drawdown")).toBeInTheDocument();
    expect(screen.getByText("Chance of Profit")).toBeInTheDocument();
    expect(screen.getByText("Risk of Ruin")).toBeInTheDocument();
    expect(screen.getByText("+$420.00")).toBeInTheDocument(); // terminal median
    expect(screen.getByText("+$1,200.00")).toBeInTheDocument(); // best case p95
    expect(screen.getByText("-$200.00")).toBeInTheDocument(); // median max drawdown
    expect(screen.getByText("92%")).toBeInTheDocument(); // 1 - prob_negative
    expect(screen.getByText("3%")).toBeInTheDocument(); // risk_of_ruin
    expect(screen.getByText(/independent draw/)).toBeInTheDocument();
  });

  it("shows the error copy on failure", () => {
    render(
      <ReportsMonteCarlo simulation={undefined} loading={false} error={true} currency="USD" />,
    );
    expect(screen.getByText("Failed to load simulation.")).toBeInTheDocument();
  });
});
