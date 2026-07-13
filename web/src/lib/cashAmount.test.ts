import { describe, expect, it } from "vitest";
import { formatCashDisplay, signedCashAmount } from "./cashAmount";

describe("signedCashAmount", () => {
	it("negates withdrawals and fees", () => {
		expect(signedCashAmount("withdrawal", 500)).toBe(-500);
		expect(signedCashAmount("fee", 12)).toBe(-12);
	});

	it("keeps deposits positive", () => {
		expect(signedCashAmount("deposit", 1000)).toBe(1000);
	});

	it("passes adjustment through as-is", () => {
		expect(signedCashAmount("adjustment", -25)).toBe(-25);
	});
});

describe("formatCashDisplay", () => {
	it("shows withdrawals as negative currency", () => {
		expect(formatCashDisplay("withdrawal", 500, "USD")).toMatch(/-?\$500\.00/);
	});
});
