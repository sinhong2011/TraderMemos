import { describe, expect, it } from "vitest";
import type { Account, Summary, Trade } from "./api/types";
import { computeHeaderStats } from "./headerStats";

const acct = (id: string, starting: number) =>
	({ id, starting_balance: starting, base_currency: "USD" }) as Account;
const summary = (netPnl: number) => ({ net_pnl: netPnl }) as Summary;
const openTrade = (qty: number, entry: number) =>
	({ status: "open", qty_opened: qty, avg_entry_price: entry }) as Trade;
const closedTrade = () =>
	({ status: "closed", qty_opened: 5, avg_entry_price: 10 }) as Trade;

describe("computeHeaderStats", () => {
	it("computes cash from starting balance, cash flow and pnl", () => {
		const s = computeHeaderStats({
			accounts: [acct("a1", 1000)],
			accountId: "a1",
			cashTx: [{ amount: 500 }, { amount: -200 }] as never,
			summary: summary(-61.79),
			trades: [],
		});
		expect(s.netPnl).toBeCloseTo(-61.79);
		expect(s.cash).toBeCloseTo(1238.21);
		expect(s.active).toBe(0);
	});

	it("sums all accounts when none selected and open trade value", () => {
		const s = computeHeaderStats({
			accounts: [acct("a1", 1000), acct("a2", 2000)],
			cashTx: [],
			summary: undefined,
			trades: [openTrade(10, 5), closedTrade()],
		});
		expect(s.cash).toBe(3000);
		expect(s.active).toBe(50);
	});
});
