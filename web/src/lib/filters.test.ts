import { beforeEach, describe, expect, it } from "vitest";
import { normalizeFilterDate, useFilters } from "./filters";

describe("filter store", () => {
	beforeEach(() => useFilters.getState().reset());
	it("sets account and date range and serializes to query params", () => {
		useFilters.getState().setAccount("acc1");
		useFilters
			.getState()
			.setRange("2026-06-01T00:00:00Z", "2026-06-30T00:00:00Z");
		const p = useFilters.getState().toParams();
		expect(p.account_id).toBe("acc1");
		expect(p.from).toBe("2026-06-01T00:00:00Z");
	});

	it("normalizes date-only filter values to RFC3339", () => {
		expect(normalizeFilterDate("2026-06-01", "start")).toBe(
			"2026-06-01T00:00:00Z",
		);
		expect(normalizeFilterDate("2026-06-30", "end")).toBe(
			"2026-06-30T23:59:59Z",
		);
		expect(normalizeFilterDate("2026-06-01T00:00:00Z", "start")).toBe(
			"2026-06-01T00:00:00Z",
		);
	});
});
