import { describe, expect, it } from "vitest";
import { checkTradeCompliance } from "./tradeCompliance";

describe("checkTradeCompliance", () => {
	it("flags long stop above entry", () => {
		const r = checkTradeCompliance({
			side: "long",
			entryPrice: 100,
			qty: 10,
			targetPrice: 120,
			stopPrice: 105,
			initialRisk: null,
		});
		expect(r.passed).toBe(false);
		expect(r.issues.some((i) => /stop must be below/i.test(i))).toBe(true);
	});

	it("passes a valid long plan", () => {
		const r = checkTradeCompliance({
			side: "long",
			entryPrice: 100,
			qty: 10,
			targetPrice: 120,
			stopPrice: 95,
			initialRisk: 50,
		});
		expect(r.passed).toBe(true);
	});

	it("fails when planned risk exceeds max risk per trade", () => {
		const r = checkTradeCompliance({
			side: "long",
			entryPrice: 100,
			qty: 10,
			targetPrice: 120,
			stopPrice: 95,
			initialRisk: 150,
			rules: { max_risk_per_trade: 100 },
		});
		expect(r.passed).toBe(false);
		expect(r.issues.some((i) => /max risk\/trade/i.test(i))).toBe(true);
	});

	it("fails when daily loss limit is already hit", () => {
		const r = checkTradeCompliance({
			side: "long",
			entryPrice: 100,
			qty: 10,
			targetPrice: 120,
			stopPrice: 95,
			initialRisk: 50,
			rules: { max_daily_loss: 200 },
			todayNetPnl: -200,
		});
		expect(r.passed).toBe(false);
		expect(r.issues.some((i) => /daily loss limit/i.test(i))).toBe(true);
	});

	it("fails when open risk plus planned risk exceeds max open risk", () => {
		const r = checkTradeCompliance({
			side: "long",
			entryPrice: 100,
			qty: 10,
			targetPrice: 120,
			stopPrice: 95,
			initialRisk: 80,
			rules: { max_open_risk: 100 },
			openRiskTotal: 40,
		});
		expect(r.passed).toBe(false);
		expect(r.issues.some((i) => /max open risk/i.test(i))).toBe(true);
	});

	it("warns when max risk/trade is set but stop/risk missing", () => {
		const r = checkTradeCompliance({
			side: "long",
			entryPrice: 100,
			qty: 10,
			targetPrice: 120,
			stopPrice: null,
			initialRisk: null,
			rules: { max_risk_per_trade: 100 },
		});
		expect(r.passed).toBe(true);
		expect(r.warnings.some((w) => /no planned risk/i.test(w))).toBe(true);
	});
});
