import { describe, expect, it } from "vite-plus/test";
import {
  balanceAsOf,
  buildDayRecords,
  dayDetail,
  dayKeyInTz,
  monthGrid,
  tradesOnDay,
  weekDetail,
  weekSummaries,
} from "./calendar";

describe("dayKeyInTz", () => {
  it("keys timestamps on the trader's calendar day", () => {
    // 00:30 UTC on the 22nd is still the evening of the 21st in New York.
    expect(dayKeyInTz("2026-07-22T00:30:00Z")).toBe("2026-07-22");
    expect(dayKeyInTz("2026-07-22T00:30:00Z", "America/New_York")).toBe("2026-07-21");
    expect(dayKeyInTz("2026-07-21T22:30:00Z", "Asia/Hong_Kong")).toBe("2026-07-22");
    expect(dayKeyInTz("2026-07-22T00:30:00Z", "UTC")).toBe("2026-07-22");
  });

  it("keeps a Friday New York close on Friday regardless of viewer offset", () => {
    // 21:59 UTC Friday = 5:59 PM ET Friday, but 5:59 AM Saturday in Hong Kong.
    // Trading-day attribution uses the market zone, so it must stay Friday.
    expect(dayKeyInTz("2026-07-31T21:59:00Z", "America/New_York")).toBe("2026-07-31");
  });
});

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

  it("attributes late-UTC closes to the trader's local day when a timezone is given", () => {
    const trades = [
      // 00:30 UTC July 22 = 20:30 ET July 21.
      { id: "x", opened_at: "2026-07-21T18:00:00Z", closed_at: "2026-07-22T00:30:00Z" },
    ];
    expect(tradesOnDay(trades, "2026-07-21", "close", "America/New_York").map((t) => t.id)).toEqual(
      ["x"],
    );
    expect(tradesOnDay(trades, "2026-07-22", "close", "America/New_York")).toEqual([]);
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
      firstDate: "2026-07-01",
      lastDate: "2026-07-04",
    });
    expect(weeks[1]).toEqual({
      pnl: 0,
      wins: 0,
      losses: 0,
      hasData: false,
      weekNumber: 2,
      daysWithTrades: 0,
      firstDate: "2026-07-05",
      lastDate: "2026-07-11",
    });
  });
});

describe("balanceAsOf", () => {
  const points = [
    { at: "2026-06-01T00:00:00Z", equity: 10000 }, // opening deposit
    { at: "2026-07-01T15:00:00Z", equity: 10200 },
    { at: "2026-07-02T15:00:00Z", equity: 10150 },
  ];

  it("reads the latest point at or before the cutoff", () => {
    expect(balanceAsOf(points, "2026-07-01T23:59:59Z")).toBe(10200);
    expect(balanceAsOf(points, "2026-07-02T23:59:59Z")).toBe(10150);
  });

  it("excludes boundary points in before mode (start-of-day balances)", () => {
    expect(balanceAsOf(points, "2026-07-01T15:00:00Z", "before")).toBe(10000);
    expect(balanceAsOf(points, "2026-07-01T15:00:00Z", "through")).toBe(10200);
  });

  it("returns 0 before any activity", () => {
    expect(balanceAsOf(points, "2026-05-01T00:00:00Z")).toBe(0);
    expect(balanceAsOf([], "2026-07-01T00:00:00Z")).toBe(0);
  });
});

describe("dayDetail", () => {
  const equityPoints = [
    { at: "2026-06-01T00:00:00Z", equity: 10000 },
    { at: "2026-07-02T15:00:00Z", equity: 10150 },
  ];
  const cashTx = [
    { amount: 10000, occurred_at: "2026-06-01T00:00:00Z", type: "deposit" },
    { amount: 500, occurred_at: "2026-07-02T09:00:00Z", type: "deposit" },
    { amount: -12, occurred_at: "2026-07-02T10:00:00Z", type: "fee" }, // not a deposit
  ];

  it("derives balances, deposits, fees, and quality stats for the day", () => {
    const detail = dayDetail({
      day: "2026-07-02",
      pnl: 150,
      dayTrades: [
        { net_pnl: 200, fees_total: 3.5 },
        { net_pnl: -50, fees_total: 1.5 },
      ],
      record: { wins: 1, losses: 1 },
      cashTx,
      equityPoints,
      dayStartISO: "2026-07-02T00:00:00Z",
      dayEndISO: "2026-07-02T23:59:59Z",
      timeZone: "UTC",
    });
    expect(detail.startBalance).toBe(10000);
    expect(detail.endBalance).toBe(10150);
    expect(detail.pct).toBeCloseTo(0.015);
    expect(detail.deposits).toBe(500); // the fee row is excluded
    expect(detail.fees).toBe(5);
    expect(detail.trades).toBe(2);
    expect(detail.winRate).toBe(0.5);
    expect(detail.profitFactor).toBe(4);
    expect(detail.expectancy).toBe(75);
  });

  it("degrades without dashes: no funding → null pct, only wins → infinite PF", () => {
    const detail = dayDetail({
      day: "2026-07-02",
      pnl: 80,
      dayTrades: [{ net_pnl: 80, fees_total: 0 }],
      record: { wins: 1, losses: 0 },
      cashTx: [],
      equityPoints: [],
      dayStartISO: "2026-07-02T00:00:00Z",
      dayEndISO: "2026-07-02T23:59:59Z",
      timeZone: "UTC",
    });
    expect(detail.pct).toBeNull(); // nothing funded yet
    expect(detail.startBalance).toBe(0);
    expect(detail.profitFactor).toBe(Infinity);
    expect(detail.deposits).toBe(0);
  });
});

describe("weekDetail", () => {
  const equityPoints = [
    { at: "2026-06-01T00:00:00Z", equity: 10000 },
    { at: "2026-07-04T15:00:00Z", equity: 10700 },
  ];
  const cashTx = [
    { amount: 10000, occurred_at: "2026-06-01T00:00:00Z", type: "deposit" },
    { amount: 500, occurred_at: "2026-07-03T09:00:00Z", type: "deposit" },
    { amount: -12, occurred_at: "2026-07-03T10:00:00Z", type: "fee" },
  ];
  const week = [
    null,
    null,
    { date: "2026-07-01", pnl: -20 },
    { date: "2026-07-02", pnl: 150 },
    { date: "2026-07-03", pnl: 50 },
    { date: "2026-07-04", pnl: 20 },
    null,
  ];

  it("derives balances, deposits, fees, and quality stats for the week", () => {
    const detail = weekDetail({
      week,
      pnl: 200,
      weekTrades: [
        { net_pnl: 200, fees_total: 3.5 },
        { net_pnl: -50, fees_total: 1.5 },
        { net_pnl: 50, fees_total: 0 },
      ],
      records: {
        "2026-07-01": { wins: 0, losses: 1 },
        "2026-07-02": { wins: 1, losses: 1 },
        "2026-07-03": { wins: 1, losses: 0 },
        "2026-07-04": { wins: 1, losses: 0 },
      },
      cashTx,
      equityPoints,
      weekStartISO: "2026-07-01T00:00:00Z",
      weekEndISO: "2026-07-04T23:59:59Z",
      timeZone: "UTC",
    });
    expect(detail.startBalance).toBe(10000);
    expect(detail.endBalance).toBe(10700);
    expect(detail.pct).toBeCloseTo(0.02);
    expect(detail.deposits).toBe(500);
    expect(detail.fees).toBe(5);
    expect(detail.trades).toBe(3);
    expect(detail.tradingDays).toBe(4);
    expect(detail.winRate).toBeCloseTo(3 / 5);
    expect(detail.profitFactor).toBe(5);
    expect(detail.expectancy).toBeCloseTo(200 / 3);
    expect(detail.bestDay).toEqual({ date: "2026-07-02", pnl: 150 });
    expect(detail.worstDay).toEqual({ date: "2026-07-01", pnl: -20 });
    expect(detail.startBalance + detail.pnl + detail.deposits).toBe(detail.endBalance);
  });

  it("counts a mid-week deposit on the market clock", () => {
    const detail = weekDetail({
      week,
      pnl: 200,
      weekTrades: [],
      records: {},
      cashTx: [
        { amount: 250, occurred_at: "2026-07-03T14:00:00Z", type: "deposit" },
        { amount: -100, occurred_at: "2026-07-03T15:00:00Z", type: "withdrawal" },
      ],
      equityPoints,
      weekStartISO: "2026-07-01T00:00:00Z",
      weekEndISO: "2026-07-04T23:59:59Z",
      timeZone: "UTC",
    });
    expect(detail.deposits).toBe(150);
  });

  it("returns infinite profit factor when the week is all wins", () => {
    const detail = weekDetail({
      week: [{ date: "2026-07-01", pnl: 80 }],
      pnl: 80,
      weekTrades: [{ net_pnl: 80, fees_total: 0 }],
      records: { "2026-07-01": { wins: 1, losses: 0 } },
      cashTx: [],
      equityPoints: [{ at: "2026-06-01T00:00:00Z", equity: 10000 }],
      weekStartISO: "2026-07-01T00:00:00Z",
      weekEndISO: "2026-07-01T23:59:59Z",
      timeZone: "UTC",
    });
    expect(detail.profitFactor).toBe(Infinity);
  });

  it("degrades gracefully for an empty week", () => {
    const emptyWeek = [
      null,
      null,
      { date: "2026-07-05", pnl: null },
      { date: "2026-07-06", pnl: null },
      { date: "2026-07-07", pnl: null },
      { date: "2026-07-08", pnl: null },
      { date: "2026-07-09", pnl: null },
    ];
    const detail = weekDetail({
      week: emptyWeek,
      pnl: 0,
      weekTrades: [],
      records: {},
      cashTx: [],
      equityPoints: [{ at: "2026-06-01T00:00:00Z", equity: 10000 }],
      weekStartISO: "2026-07-05T00:00:00Z",
      weekEndISO: "2026-07-09T23:59:59Z",
      timeZone: "UTC",
    });
    expect(detail.tradingDays).toBe(0);
    expect(detail.trades).toBe(0);
    expect(detail.bestDay).toBeNull();
    expect(detail.worstDay).toBeNull();
    expect(detail.winRate).toBeNull();
    expect(detail.profitFactor).toBeNull();
    expect(detail.deposits).toBe(0);
  });
});
