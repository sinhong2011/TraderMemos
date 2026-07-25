import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { AnnualGoalCard } from "./AnnualGoalCard";
import { GoalProgressBar } from "./GoalProgressBar";

describe("GoalProgressBar", () => {
  it("exposes progressbar semantics", () => {
    render(<GoalProgressBar progress={0.46} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "46");
  });
});

describe("AnnualGoalCard", () => {
  it("shows set-goal CTA when unset", () => {
    render(
      <AnnualGoalCard
        year={2026}
        goalAmount={null}
        ytdNetPnl={0}
        currency="USD"
        onSave={vi.fn<(...args: any[]) => any>(async () => {})}
      />,
    );
    expect(screen.getByText(/Set a 2026 net P&L target/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /set annual goal/i })).toBeInTheDocument();
  });

  it("renders hero progress when goal is set", () => {
    render(
      <AnnualGoalCard
        year={2026}
        goalAmount={100_000}
        ytdNetPnl={46_000}
        currency="USD"
        variant="hero"
        onSave={vi.fn<(...args: any[]) => any>(async () => {})}
        onClear={vi.fn<(...args: any[]) => any>(async () => {})}
      />,
    );
    expect(screen.getByText(/Annual P&L Goal/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText(/vs linear pace/i)).toBeInTheDocument();
  });

  it("renders compact of-goal copy", () => {
    render(
      <AnnualGoalCard
        year={2026}
        goalAmount={100_000}
        ytdNetPnl={46_000}
        currency="USD"
        variant="compact"
        onSave={vi.fn<(...args: any[]) => any>(async () => {})}
      />,
    );
    expect(screen.getByText(/of/i)).toBeInTheDocument();
  });
});
