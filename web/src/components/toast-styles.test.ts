import { describe, expect, it } from "vitest";
import {
	resolveToastVariant,
	toastRootClass,
} from "./toast-styles";

describe("resolveToastVariant", () => {
	it("respects explicit type", () => {
		expect(resolveToastVariant("error", "Saved")).toBe("error");
		expect(resolveToastVariant("success", "Failed")).toBe("success");
	});

	it("infers success and error from title", () => {
		expect(resolveToastVariant(undefined, "Journal saved")).toBe("success");
		expect(resolveToastVariant(undefined, "Could not save journal")).toBe(
			"error",
		);
		expect(resolveToastVariant(undefined, "Import finished with errors")).toBe(
			"warning",
		);
	});
});

describe("toastRootClass", () => {
	it("uses overlay radius and hard shadow", () => {
		expect(toastRootClass("default")).toContain("rounded-[var(--radius-overlay)]");
		expect(toastRootClass("default")).toContain("shadow-hard");
	});
});
