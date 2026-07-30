import { describe, expect, it } from "vite-plus/test";
import { computeAnnualGoalProgress, ytdFiltersForYear } from "./annualGoal";

describe("computeAnnualGoalProgress", () => {
  it("computes percent, remaining, and over-by", () => {
    const now = new Date(2026, 6, 25); // Jul 25
    const p = computeAnnualGoalProgress(100_000, 46_000, 2026, now);
    expect(p.progressPct).toBeCloseTo(46, 5);
    expect(p.remaining).toBe(54_000);
    expect(p.overBy).toBe(0);
    expect(p.paceStatus).not.toBe("over");
  });

  it("marks over when YTD exceeds goal", () => {
    const p = computeAnnualGoalProgress(100_000, 120_000, 2026, new Date(2026, 11, 15));
    expect(p.paceStatus).toBe("over");
    expect(p.overBy).toBe(20_000);
    expect(p.remaining).toBe(0);
    expect(p.progress).toBeCloseTo(1.2, 5);
  });

  it("flags behind when under linear pace", () => {
    // Mid-year (~day 183 of 365) expected ≈ 50k; 10k is behind
    const mid = new Date(2026, 5, 30);
    const p = computeAnnualGoalProgress(100_000, 10_000, 2026, mid);
    expect(p.paceStatus).toBe("behind");
  });
});

describe("ytdFiltersForYear", () => {
  it("uses YTD bounds for the current year", () => {
    const now = new Date(2026, 6, 25);
    const f = ytdFiltersForYear({ account_id: "a1" }, 2026, now);
    expect(f.account_id).toBe("a1");
    expect(f.from?.startsWith("2026-01-01")).toBe(true);
    expect(f.to?.startsWith("2026-07-25")).toBe(true);
  });

  it("uses full calendar year for past years", () => {
    const f = ytdFiltersForYear({}, 2024, new Date(2026, 0, 1));
    expect(f.from).toBe("2024-01-01T00:00:00Z");
    expect(f.to).toBe("2024-12-31T23:59:59Z");
  });
});
