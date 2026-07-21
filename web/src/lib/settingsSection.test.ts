import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_SETTINGS_SECTION,
  parseSettingsHash,
  settingsSectionHash,
} from "./settingsSection";

describe("parseSettingsHash", () => {
  it("parses valid section hashes", () => {
    expect(parseSettingsHash("#rules")).toBe("rules");
    expect(parseSettingsHash("#journal")).toBe("journal");
    expect(parseSettingsHash("#ai")).toBe("ai");
  });

  it("falls back to accounts for unknown hashes", () => {
    expect(parseSettingsHash("#unknown")).toBe(DEFAULT_SETTINGS_SECTION);
    expect(parseSettingsHash("")).toBe(DEFAULT_SETTINGS_SECTION);
  });
});

describe("settingsSectionHash", () => {
  it("builds hash links", () => {
    expect(settingsSectionHash("general")).toBe("#general");
    expect(settingsSectionHash("ai")).toBe("#ai");
  });
});
