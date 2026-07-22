import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "./api/types";
import { computeAccountContribution, computeDashboardInsights } from "./dashboardInsights";

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t1",
    account_id: "a1",
    symbol: "NQ",
    instrument_type: "future",
    direction: "long",
    status: "closed",
    opened_at: "2026-07-01T10:00:00Z",
    closed_at: "2026-07-01T11:00:00Z",
    qty_opened: 1,
    qty_remaining: 0,
    avg_entry_price: 100,
    avg_exit_price: 110,
    gross_pnl: 10,
    fees_total: 0,
    net_pnl: 10,
    pnl_currency: "USD",
    return_pct: 0.1,
    time_in_trade_secs: 3600,
    notes: "",
    tags: [],
    ...over,
  };
}

describe("computeDashboardInsights", () => {
  it("computes win/loss streaks in chronological order", () => {
    const trades = [
      trade({ id: "1", closed_at: "2026-07-03T12:00:00Z", net_pnl: 10 }),
      trade({ id: "2", closed_at: "2026-07-01T12:00:00Z", net_pnl: 5 }),
      trade({ id: "3", closed_at: "2026-07-02T12:00:00Z", net_pnl: 8 }),
      trade({ id: "4", closed_at: "2026-07-04T12:00:00Z", net_pnl: -3 }),
      trade({ id: "5", closed_at: "2026-07-05T12:00:00Z", net_pnl: -2 }),
    ];
    const out = computeDashboardInsights(trades);
    expect(out.bestStreak).toBe(3);
    expect(out.worstStreak).toBe(2);
  });

  it("aggregates best and worst days", () => {
    const trades = [
      trade({
        id: "1",
        closed_at: "2026-07-01T12:00:00Z",
        net_pnl: 100,
        time_in_trade_secs: 600,
      }),
      trade({
        id: "2",
        closed_at: "2026-07-01T14:00:00Z",
        net_pnl: 50,
        time_in_trade_secs: 600,
      }),
      trade({
        id: "3",
        closed_at: "2026-07-02T12:00:00Z",
        net_pnl: -80,
        time_in_trade_secs: 1200,
      }),
    ];
    const out = computeDashboardInsights(trades);
    expect(out.bestDay).toEqual({ date: "2026-07-01", pnl: 150 });
    expect(out.worstDay).toEqual({ date: "2026-07-02", pnl: -80 });
  });

  it("finds main mistake and top symbol", () => {
    const trades = [
      trade({
        id: "1",
        symbol: "NQ",
        tags: [
          { id: "m1", user_id: "u", name: "FOMO", color: "", description: "", kind: "mistake" },
        ],
      }),
      trade({
        id: "2",
        symbol: "NQ",
        tags: [
          { id: "m1", user_id: "u", name: "FOMO", color: "", description: "", kind: "mistake" },
        ],
      }),
      trade({
        id: "3",
        symbol: "ES",
        tags: [
          {
            id: "m2",
            user_id: "u",
            name: "Early Exit",
            color: "",
            description: "",
            kind: "mistake",
          },
        ],
      }),
    ];
    const out = computeDashboardInsights(trades);
    expect(out.mainMistake).toBe("FOMO");
    expect(out.topSymbol).toBe("NQ");
  });

  it("averages hold times for wins and losses", () => {
    const trades = [
      trade({ id: "1", net_pnl: 10, time_in_trade_secs: 600 }),
      trade({ id: "2", net_pnl: 20, time_in_trade_secs: 1200 }),
      trade({ id: "3", net_pnl: -5, time_in_trade_secs: 300 }),
    ];
    const out = computeDashboardInsights(trades);
    expect(out.avgHoldSecs).toBe(700);
    expect(out.winHoldSecs).toBe(900);
    expect(out.lossHoldSecs).toBe(300);
  });
});

describe("computeAccountContribution", () => {
  it("aggregates per-account pnl and win rate", () => {
    const out = computeAccountContribution(
      [
        trade({ id: "1", account_id: "a1", net_pnl: 100 }),
        trade({ id: "2", account_id: "a1", net_pnl: -40 }),
        trade({ id: "3", account_id: "a2", net_pnl: 50 }),
        trade({ id: "4", account_id: "a2", status: "open", net_pnl: null }),
      ],
      [
        { id: "a1", name: "Prop" },
        { id: "a2", name: "Personal" },
      ],
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      accountId: "a1",
      name: "Prop",
      trades: 2,
      wins: 1,
      losses: 1,
      netPnl: 60,
    });
    expect(out[1].name).toBe("Personal");
    expect(out[1].trades).toBe(1);
  });

  it("returns a single row for one-account datasets", () => {
    expect(
      computeAccountContribution([trade({ account_id: "a1" })], [{ id: "a1", name: "Only" }]),
    ).toHaveLength(1);
  });
});
