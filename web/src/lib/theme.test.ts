import { describe, expect, it } from "vitest";
import { pnlColor } from "../components/theme-tokens";

describe("pnlColor", () => {
	it("maps sign to semantic classes", () => {
		expect(pnlColor(120)).toBe("text-emerald-400");
		expect(pnlColor(-5)).toBe("text-red-400");
		expect(pnlColor(0)).toBe("text-zinc-400");
	});
});
