import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { ExecAxisScore, ExecScoreReport } from "@/lib/api/types";
import { execScoreBand, ReportsExecutionScore } from "./ReportsExecutionScore";

const axis = (score: number | null, scored = 10, excluded = 0): ExecAxisScore => ({
  score,
  scored,
  excluded,
});

function report(overrides: Partial<ExecScoreReport> = {}): ExecScoreReport {
  return {
    trades: 24,
    rules_configured: true,
    bucket: "week",
    composite: 71.3,
    entry: axis(64),
    exit: axis(55),
    risk: axis(88),
    stability: axis(70),
    tempo: axis(95),
    series: [
      {
        date: "2026-06-29",
        trades: 12,
        composite: 68,
        entry: 60,
        exit: 50,
        risk: 85,
        stability: 66,
        tempo: 90,
      },
      {
        date: "2026-07-06",
        trades: 12,
        composite: 74,
        entry: 68,
        exit: 60,
        risk: 91,
        stability: 74,
        tempo: 100,
      },
    ],
    ...overrides,
  };
}

const props = { loading: false, error: false, bucket: "week" as const, onBucketChange: vi.fn() };

describe("ReportsExecutionScore", () => {
  it("renders the composite score with its band and trade count", () => {
    render(<ReportsExecutionScore {...props} report={report()} />);
    expect(screen.getByTestId("exec-score-composite")).toHaveTextContent("71");
    expect(screen.getByText(/strong · 24 trades/)).toBeInTheDocument();
  });

  it("renders one selectable chip per axis plus the composite", () => {
    render(<ReportsExecutionScore {...props} report={report()} />);
    for (const label of ["Composite", "Entry", "Exit", "Risk", "Stability", "Tempo"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
    const entry = screen.getByRole("button", { name: /Entry/ });
    fireEvent.click(entry);
    expect(entry).toHaveAttribute("aria-pressed", "true");
  });

  it("disables chips for axes without data", () => {
    render(<ReportsExecutionScore {...props} report={report({ entry: axis(null, 0, 24) })} />);
    const entry = screen.getByRole("button", { name: /Entry/ });
    expect(entry).toBeDisabled();
    expect(entry).toHaveTextContent(/no data/);
  });

  it("shows the unlock hint when there are trades but no composite", () => {
    render(
      <ReportsExecutionScore
        {...props}
        report={report({
          composite: null,
          entry: axis(null, 0, 3),
          exit: axis(null, 0, 3),
          risk: axis(null, 0, 3),
          stability: axis(null, 0, 3),
          tempo: axis(null, 0, 3),
          trades: 3,
        })}
      />,
    );
    expect(screen.getByText("Not enough data to score")).toBeInTheDocument();
  });

  it("shows the empty state without trades", () => {
    render(
      <ReportsExecutionScore
        {...props}
        report={report({ trades: 0, composite: null, series: [] })}
      />,
    );
    expect(screen.getByText("No trades")).toBeInTheDocument();
  });

  it("reports bucket changes", () => {
    const onBucketChange = vi.fn();
    render(<ReportsExecutionScore {...props} onBucketChange={onBucketChange} report={report()} />);
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(onBucketChange).toHaveBeenCalledWith("month");
  });
});

describe("execScoreBand", () => {
  it("bands scores from weak to excellent", () => {
    expect(execScoreBand(90)).toBe("excellent");
    expect(execScoreBand(70)).toBe("strong");
    expect(execScoreBand(55)).toBe("solid");
    expect(execScoreBand(40)).toBe("uneven");
    expect(execScoreBand(10)).toBe("weak");
  });
});
