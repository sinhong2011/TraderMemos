import { describe, expect, it } from "vitest";
import {
	DEFAULT_SETTINGS_SECTION,
	parseSettingsHash,
	settingsSectionHash,
} from "./settingsSection";

describe("parseSettingsHash", () => {
	it("parses valid section hashes", () => {
		expect(parseSettingsHash("#rules")).toBe("rules");
		expect(parseSettingsHash("#journal")).toBe("journal");
	});

	it("falls back to accounts for unknown hashes", () => {
		expect(parseSettingsHash("#unknown")).toBe(DEFAULT_SETTINGS_SECTION);
		expect(parseSettingsHash("")).toBe(DEFAULT_SETTINGS_SECTION);
	});
});

describe("settingsSectionHash", () => {
	it("builds hash links", () => {
		expect(settingsSectionHash("general")).toBe("#general");
	});
});
