import { describe, expect, it } from "vite-plus/test";
import type { Account, Summary, Trade } from "./api/types";
import { computeHeaderStats, netDeposits } from "./headerStats";

const acct = (id: string, starting: number) =>
  ({ id, starting_balance: starting, base_currency: "USD" }) as Account;
const summary = (netPnl: number) => ({ net_pnl: netPnl }) as Summary;
const openTrade = (qty: number, entry: number) =>
  ({ status: "open", qty_opened: qty, avg_entry_price: entry }) as Trade;
const closedTrade = () => ({ status: "closed", qty_opened: 5, avg_entry_price: 10 }) as Trade;

describe("netDeposits", () => {
  it("reads the ledger only, ignoring the starting_balance metadata", () => {
    // The 10000 starting balance is already in the ledger as "Opening balance";
    // counting the field too would report 21589.47.
    const d = netDeposits({
      accounts: [acct("a1", 10000)],
      accountId: "a1",
      cashTx: [
        { account_id: "a1", amount: 10000 },
        { account_id: "a1", amount: 1589.47 },
      ] as never,
    });
    expect(d).toBeCloseTo(11589.47);
  });

  it("nets withdrawals out and scopes to the selected account", () => {
    const cashTx = [
      { account_id: "a1", amount: 1000 },
      { account_id: "a1", amount: -250 },
      { account_id: "a2", amount: 4000 },
    ] as never;
    expect(netDeposits({ accounts: [acct("a1", 0), acct("a2", 0)], cashTx })).toBe(4750);
    expect(netDeposits({ accounts: [acct("a1", 0), acct("a2", 0)], accountId: "a1", cashTx })).toBe(
      750,
    );
  });

  it("is zero for an unfunded account, which disables % mode", () => {
    expect(netDeposits({ accounts: [acct("a1", 0)], accountId: "a1", cashTx: [] })).toBe(0);
  });
});

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
    expect(s.netPnlPct).toBeCloseTo(-61.79 / 1300);
    expect(s.active).toBe(0);
  });

  it("has no return pct without funded capital", () => {
    const s = computeHeaderStats({
      accounts: [acct("a1", 0)],
      accountId: "a1",
      cashTx: [],
      summary: summary(120),
      trades: [],
    });
    expect(s.netPnlPct).toBeNull();
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
