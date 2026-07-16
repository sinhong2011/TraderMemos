import { beforeEach, describe, expect, it } from "vite-plus/test";
import { DISPLAY_PREFS_STORAGE_KEY, PRIVACY_MASK, useDisplayPrefs } from "./displayPrefs";
import {
  fmtDateShort,
  fmtDateTime,
  fmtDayShort,
  fmtDuration,
  fmtMoney,
  fmtMoneyCompact,
  fmtPct,
  fmtRecord,
  fmtSignedMoney,
  fmtSignedMoneyCompact,
} from "./format";

describe("formatters", () => {
  beforeEach(() => {
    localStorage.removeItem(DISPLAY_PREFS_STORAGE_KEY);
    useDisplayPrefs.setState({ displayCurrency: null, privacyMode: false });
  });

  it("formats money by locale + currency", () => {
    expect(fmtMoney(4182, "USD", "en-US")).toBe("$4,182.00");
  });

  it("masks money when privacy mode is on", () => {
    useDisplayPrefs.getState().setPrivacyMode(true);
    expect(fmtMoney(4182, "USD", "en-US")).toBe(PRIVACY_MASK);
    expect(fmtSignedMoney(-102, "USD", "en-US")).toBe(PRIVACY_MASK);
  });
  it("formats compact money for chart axes", () => {
    expect(fmtMoneyCompact(11790, "USD", "en-US")).toBe("$11.8K");
  });
  it("formats compact signed money", () => {
    expect(fmtSignedMoneyCompact(1460, "USD", "en-US")).toBe("+$1.5K");
    expect(fmtSignedMoneyCompact(-586, "USD", "en-US")).toBe("-$586");
  });
  it("renders short day labels for chart axes", () => {
    expect(fmtDayShort("2026-07-09T12:00:00", "en-US")).toBe("Jul 9");
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
  it("formats yyyy-MM-dd from ISO timestamps", () => {
    expect(fmtDateShort("2026-07-02T14:30:00Z")).toBe("2026-07-02");
    expect(fmtDateShort("2026-07-09T12:00:00")).toBe("2026-07-09");
    expect(fmtDateShort(null)).toBe("-");
  });
});

describe("fmtDateTime", () => {
  it("formats ISO timestamps for display", () => {
    const formatted = fmtDateTime("2026-07-10T15:19:46.000Z", "en-US");
    expect(formatted).toMatch(/Jul 10, 2026/);
    expect(formatted).not.toContain("T15:19");
  });

  it("formats date-only strings without time", () => {
    expect(fmtDateTime("2026-01-02", "en-US")).toBe("Jan 2, 2026");
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
