import { describe, expect, it } from "vitest";
import {
	fmtDateShort,
	fmtDuration,
	fmtMoney,
	fmtPct,
	fmtRecord,
	fmtSignedMoney,
} from "./format";

describe("formatters", () => {
	it("formats money by locale + currency", () => {
		expect(fmtMoney(4182, "USD", "en-US")).toBe("$4,182.00");
	});
	it("formats signed money", () => {
		expect(fmtSignedMoney(198, "USD", "en-US")).toBe("+$198.00");
		expect(fmtSignedMoney(-102, "USD", "en-US")).toBe("-$102.00");
	});
	it("formats percent", () => {
		expect(fmtPct(0.58, "en-US")).toBe("58%");
	});
});

describe("fmtDuration", () => {
	it("formats minutes, hours, days", () => {
		expect(fmtDuration(2340)).toBe("39m");
		expect(fmtDuration(3600)).toBe("1h");
		expect(fmtDuration(7200)).toBe("2h");
		expect(fmtDuration(172800)).toBe("2d");
	});
	it("handles null/zero", () => {
		expect(fmtDuration(null)).toBe("-");
		expect(fmtDuration(0)).toBe("-");
		expect(fmtDuration(30)).toBe("1m");
	});
});

describe("fmtDateShort", () => {
	it("formats M/D/YYYY", () => {
		expect(fmtDateShort("2026-07-02T14:30:00Z")).toMatch(/^7\/[12]\/2026$/);
		expect(fmtDateShort(null)).toBe("-");
	});
});

describe("fmtRecord", () => {
	it("formats win/loss record", () => {
		expect(fmtRecord(2, 1)).toBe("2W1L");
		expect(fmtRecord(0, 1)).toBe("1L");
		expect(fmtRecord(2, 0)).toBe("2W");
		expect(fmtRecord(0, 0)).toBe("-");
	});
});
