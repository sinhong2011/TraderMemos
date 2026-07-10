import { describe, expect, it } from "vitest";
import { positionSizeFromRisk } from "./positionSize";

describe("positionSizeFromRisk", () => {
	it("sizes a long from 1% of 10k with $1 stop", () => {
		const r = positionSizeFromRisk({
			equity: 10_000,
			riskPct: 1,
			entryPrice: 100,
			stopPrice: 99,
		});
		expect(r).not.toBeNull();
		expect(r!.riskDollars).toBe(100);
		expect(r!.qty).toBe(100);
	});
});
