import { beforeEach, describe, expect, it } from "vite-plus/test";
import { DISPLAY_PREFS_STORAGE_KEY, PRIVACY_MASK, useDisplayPrefs } from "./displayPrefs";
import {
  fmtDate,
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
  fmtTime,
  fmtTradeDay,
} from "./format";

describe("formatters", () => {
  beforeEach(() => {
    localStorage.removeItem(DISPLAY_PREFS_STORAGE_KEY);
    useDisplayPrefs.setState({
      displayCurrency: null,
      privacyMode: false,
      timezone: "UTC",
      timeFormat: "h23",
    });
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
    expect(fmtDayShort("2026-07-09T12:00:00Z", "en-US")).toBe("Jul 9");
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

describe("fmtTradeDay", () => {
  beforeEach(() => {
    localStorage.removeItem(DISPLAY_PREFS_STORAGE_KEY);
    useDisplayPrefs.setState({ marketTimezone: "America/New_York" });
  });

  it("files evening ET fills under the market day, not the UTC date", () => {
    // 21:52 ET on Aug 3 is already Aug 4 in UTC — the trading day is still Aug 3.
    expect(fmtTradeDay("2026-08-04T01:52:28Z")).toBe("2026-08-03");
    expect(fmtTradeDay("2026-08-03T13:52:28Z")).toBe("2026-08-03");
  });

  it("follows the market timezone pref", () => {
    useDisplayPrefs.setState({ marketTimezone: "Asia/Hong_Kong" });
    expect(fmtTradeDay("2026-08-03T20:00:00Z")).toBe("2026-08-04");
  });

  it("handles null and garbage", () => {
    expect(fmtTradeDay(null)).toBe("-");
    expect(fmtTradeDay("not-a-date")).toBe("-");
  });
});

describe("fmtDate", () => {
  beforeEach(() => {
    localStorage.removeItem(DISPLAY_PREFS_STORAGE_KEY);
    useDisplayPrefs.setState({
      displayCurrency: null,
      privacyMode: false,
      timezone: "UTC",
      timeFormat: "h23",
    });
  });

  it("formats calendar dates with locale and display timezone", () => {
    expect(fmtDate("2026-07-22T10:31:04.000Z", "en-US")).toBe("Jul 22, 2026");
  });

  it("honors display timezone for day boundary", () => {
    useDisplayPrefs.getState().setTimezone("Asia/Hong_Kong");
    // 2026-07-21 16:00 UTC → Jul 22 in HKT
    expect(fmtDate("2026-07-21T16:00:00.000Z", "en-US")).toBe("Jul 22, 2026");
  });
});

describe("fmtDateTime", () => {
  beforeEach(() => {
    localStorage.removeItem(DISPLAY_PREFS_STORAGE_KEY);
    useDisplayPrefs.setState({
      displayCurrency: null,
      privacyMode: false,
      timezone: "UTC",
      timeFormat: "h23",
    });
  });

  it("formats ISO timestamps for display", () => {
    const formatted = fmtDateTime("2026-07-10T15:19:46.000Z", "en-US");
    expect(formatted).toMatch(/Jul 10, 2026/);
    expect(formatted).toMatch(/15:19/);
    expect(formatted).not.toContain("T15:19");
  });

  it("honors display timezone and 12-hour clock", () => {
    useDisplayPrefs.getState().setTimezone("Asia/Hong_Kong");
    useDisplayPrefs.getState().setTimeFormat("h12");
    // 15:19 UTC → 23:19 HKT
    const formatted = fmtDateTime("2026-07-10T15:19:46.000Z", "en-US");
    expect(formatted).toMatch(/11:19\s*PM/i);
  });

  it("formats date-only strings without time", () => {
    expect(fmtDateTime("2026-01-02", "en-US")).toBe("Jan 2, 2026");
  });

  it("formats time-of-day via fmtTime", () => {
    expect(fmtTime("2026-07-10T15:19:46.000Z", "en-US")).toBe("15:19");
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
