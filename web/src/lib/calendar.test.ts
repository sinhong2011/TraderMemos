import { describe, expect, it } from "vite-plus/test";
import { buildDayRecords, monthGrid, tradesOnDay, weekSummaries } from "./calendar";

describe("monthGrid", () => {
  it("builds a 6x7 grid covering the month with pnl mapped by day", () => {
    const pnl = { "2026-06-01": 200, "2026-06-15": -50 };
    const grid = monthGrid(2026, 6, pnl); // month is 1-based
    expect(grid.weeks.length).toBe(6);
    expect(grid.weeks[0].length).toBe(7);
    const june1 = grid.weeks.flat().find((c) => c?.date === "2026-06-01");
    expect(june1?.pnl).toBe(200);
    expect(grid.monthTotal).toBe(150);
  });
});

describe("buildDayRecords", () => {
  it("counts wins and losses per close date by default", () => {
    const records = buildDayRecords([
      { opened_at: "2026-07-01T10:00:00Z", closed_at: "2026-07-02T14:00:00Z", net_pnl: 11.39 },
      { opened_at: "2026-07-02T10:00:00Z", closed_at: "2026-07-02T15:00:00Z", net_pnl: 58.09 },
      { opened_at: "2026-07-02T11:00:00Z", closed_at: "2026-07-02T16:00:00Z", net_pnl: -111.24 },
      { opened_at: "2026-07-01T09:00:00Z", closed_at: "2026-07-01T16:00:00Z", net_pnl: -20.03 },
      { opened_at: "2026-07-03T09:00:00Z", closed_at: null, net_pnl: null },
      { opened_at: "2026-07-03T09:00:00Z", closed_at: "2026-07-03T16:00:00Z", net_pnl: 0 },
    ]);
    expect(records["2026-07-02"]).toEqual({ wins: 2, losses: 1 });
    expect(records["2026-07-01"]).toEqual({ wins: 0, losses: 1 });
    expect(records["2026-07-03"]).toBeUndefined();
  });

  it("can bucket by open date", () => {
    const records = buildDayRecords(
      [
        { opened_at: "2026-07-21T20:00:00Z", closed_at: "2026-07-22T14:00:00Z", net_pnl: 40 },
        { opened_at: "2026-07-22T10:00:00Z", closed_at: "2026-07-22T15:00:00Z", net_pnl: 48.3 },
      ],
      "open",
    );
    expect(records["2026-07-21"]).toEqual({ wins: 1, losses: 0 });
    expect(records["2026-07-22"]).toEqual({ wins: 1, losses: 0 });
  });
});

describe("tradesOnDay", () => {
  it("keeps overnight closes on the closed_at day under close basis", () => {
    const trades = [
      { id: "a", opened_at: "2026-07-21T20:00:00Z", closed_at: "2026-07-22T14:00:00Z" },
      { id: "b", opened_at: "2026-07-21T10:00:00Z", closed_at: "2026-07-21T22:00:00Z" },
      { id: "c", opened_at: "2026-07-22T09:00:00Z", closed_at: null },
      { id: "d", opened_at: "2026-07-21T22:30:00Z", closed_at: "2026-07-22T15:10:00Z" },
    ];
    expect(tradesOnDay(trades, "2026-07-22", "close").map((t) => t.id)).toEqual(["a", "d"]);
    expect(tradesOnDay(trades, "2026-07-21", "open").map((t) => t.id)).toEqual(["a", "b", "d"]);
  });
});

describe("weekSummaries", () => {
  it("sums pnl and records per grid row", () => {
    const pnl = { "2026-07-01": -20.03, "2026-07-02": -41.76 };
    const grid = monthGrid(2026, 7, pnl);
    const records = buildDayRecords([
      { opened_at: "2026-07-01T10:00:00Z", closed_at: "2026-07-01T16:00:00Z", net_pnl: -20.03 },
      { opened_at: "2026-07-02T10:00:00Z", closed_at: "2026-07-02T14:00:00Z", net_pnl: 11.39 },
      { opened_at: "2026-07-02T11:00:00Z", closed_at: "2026-07-02T15:00:00Z", net_pnl: 58.09 },
      { opened_at: "2026-07-02T12:00:00Z", closed_at: "2026-07-02T16:00:00Z", net_pnl: -111.24 },
    ]);
    const weeks = weekSummaries(grid.weeks, records);
    expect(weeks).toHaveLength(6);
    // July 2026: the 1st and 2nd fall in the first grid row (Wed/Thu).
    expect(weeks[0]).toEqual({
      pnl: -61.79,
      wins: 2,
      losses: 2,
      hasData: true,
      weekNumber: 1,
      daysWithTrades: 2,
    });
    expect(weeks[1]).toEqual({
      pnl: 0,
      wins: 0,
      losses: 0,
      hasData: false,
      weekNumber: 2,
      daysWithTrades: 0,
    });
  });
});
