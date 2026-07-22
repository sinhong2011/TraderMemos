import { describe, expect, it } from "vite-plus/test";
import type { Account, Summary, Trade } from "./api/types";
import { computeHeaderStats } from "./headerStats";

const acct = (id: string, starting: number) =>
  ({ id, starting_balance: starting, base_currency: "USD" }) as Account;
const summary = (netPnl: number) => ({ net_pnl: netPnl }) as Summary;
const openTrade = (qty: number, entry: number) =>
  ({ status: "open", qty_opened: qty, avg_entry_price: entry }) as Trade;
const closedTrade = () => ({ status: "closed", qty_opened: 5, avg_entry_price: 10 }) as Trade;

describe("computeHeaderStats", () => {
  it("computes cash from cash ledger and pnl", () => {
    const s = computeHeaderStats({
      accounts: [acct("a1", 1000)],
      accountId: "a1",
      cashTx: [
        { account_id: "a1", amount: 1000 },
        { account_id: "a1", amount: 500 },
        { account_id: "a1", amount: -200 },
      ] as never,
      summary: summary(-61.79),
      trades: [],
    });
    expect(s.netPnl).toBeCloseTo(-61.79);
    expect(s.cash).toBeCloseTo(1238.21);
    expect(s.active).toBe(0);
  });

  it("sums selected accounts cash only and open trade value", () => {
    const s = computeHeaderStats({
      accounts: [acct("a1", 1000), acct("a2", 2000)],
      cashTx: [
        { account_id: "a1", amount: 1000 },
        { account_id: "a2", amount: 2000 },
      ] as never,
      summary: undefined,
      trades: [openTrade(10, 5), closedTrade()],
    });
    expect(s.cash).toBe(3000);
    expect(s.active).toBe(50);
  });
});
