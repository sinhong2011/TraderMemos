import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { MissedSummary, MissedTrade } from "@/lib/api/missedTrades";
import { fmtR, MissedListCard, MissedSummaryCard, planProblem } from "./MissedTradesView";

const trade = (over: Partial<MissedTrade>): MissedTrade => ({
  id: "m1",
  account_id: null,
  setup_id: null,
  symbol: "NVDA",
  direction: "long",
  observed_at: "2026-09-29T14:00:00Z",
  entry: 100,
  stop: 98,
  target: 105,
  reason: "hesitated",
  outcome: "target",
  notes: "",
  planned_r: 2.5,
  r: 2.5,
  created_at: "2026-09-29T14:00:00Z",
  updated_at: "2026-09-29T14:00:00Z",
  ...over,
});

describe("fmtR", () => {
  it("signs and trims", () => {
    expect(fmtR(2.5)).toBe("+2.5R");
    expect(fmtR(-1)).toBe("-1R");
    expect(fmtR(0)).toBe("0R");
    expect(fmtR(1.25)).toBe("+1.25R");
  });
});

describe("planProblem", () => {
  it("matches the API's direction rule", () => {
    expect(planProblem({ direction: "long", entry: 100, stop: 98, target: 105 })).toBeNull();
    expect(planProblem({ direction: "long", entry: 100, stop: 101, target: 105 })).toMatch(/long/);
    expect(planProblem({ direction: "short", entry: 50, stop: 51, target: 47 })).toBeNull();
    expect(planProblem({ direction: "short", entry: 50, stop: 49, target: 47 })).toMatch(/short/);
    expect(planProblem({ direction: "long", entry: 100, stop: null, target: 105 })).toBeNull();
  });
});

describe("MissedListCard", () => {
  it("changes an outcome inline and marks unscored rows Pending", () => {
    const onOutcome = vi.fn<(t: MissedTrade, o: string) => void>();
    render(
      <MissedListCard
        trades={[trade({}), trade({ id: "m2", symbol: "TSLA", outcome: "unknown", r: null })]}
        loading={false}
        error={false}
        setupName={() => "ORB"}
        onAdd={vi.fn<() => void>()}
        onEdit={vi.fn<(t: MissedTrade) => void>()}
        onDelete={vi.fn<(t: MissedTrade) => void>()}
        onOutcome={onOutcome}
      />,
    );
    expect(screen.getByText("+2.5R")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Outcome for TSLA"), { target: { value: "stop" } });
    expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ id: "m2" }), "stop");
  });
});

describe("MissedSummaryCard", () => {
  const summary: MissedSummary = {
    count: 3,
    outcomes: { unknown: 1, target: 1, stop: 1, no_trigger: 0 },
    scored: 2,
    r_left: 2.5,
    r_avoided: 1,
    net_r: 1.5,
    avg_r: 0.75,
    by_reason: [{ key: "hesitated", count: 2, scored: 2, net_r: 1.5 }],
    by_setup: [],
    unpriced: 0,
  };

  it("leads with net R and flags misses still needing an outcome", () => {
    render(
      <MissedSummaryCard summary={summary} loading={false} error={false} setupName={(id) => id} />,
    );
    expect(screen.getByTestId("missed-net-r").textContent).toBe("+1.5R");
    expect(screen.getByText("1 need an outcome")).toBeTruthy();
    expect(screen.getByText("Hesitated")).toBeTruthy();
    expect(screen.queryByText("By setup")).toBeNull();
  });

  it("says so when nothing is logged", () => {
    render(
      <MissedSummaryCard
        summary={{ ...summary, count: 0, scored: 0, by_reason: [] }}
        loading={false}
        error={false}
        setupName={(id) => id}
      />,
    );
    expect(screen.getByText("No missed trades logged")).toBeTruthy();
  });
});
