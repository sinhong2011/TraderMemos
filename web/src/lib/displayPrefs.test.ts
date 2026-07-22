import { describe, expect, it, beforeEach } from "vite-plus/test";
import {
  accountBaseCurrency,
  DISPLAY_PREFS_STORAGE_KEY,
  formatUtcHourLabel,
  formatUtcOffsetPrefix,
  resolveDisplayTimezone,
  resolveDisplayCurrency,
  timezoneSelectOptions,
  useDisplayPrefs,
} from "./displayPrefs";

describe("accountBaseCurrency", () => {
  const accounts = [
    { id: "a1", name: "Live", base_currency: "HKD" },
    { id: "a2", name: "Paper", base_currency: "USD" },
  ] as const;

  it("returns the selected account base currency", () => {
    expect(accountBaseCurrency(accounts, "a1")).toBe("HKD");
    expect(accountBaseCurrency(accounts, "a2")).toBe("USD");
  });

  it("falls back when no account is selected", () => {
    expect(accountBaseCurrency(accounts, undefined)).toBe("USD");
  });
});

describe("display currency override", () => {
  beforeEach(() => {
    localStorage.removeItem(DISPLAY_PREFS_STORAGE_KEY);
    useDisplayPrefs.setState({
      displayCurrency: null,
      privacyMode: false,
      timezone: "America/New_York",
      timeFormat: "h12",
      tradeDateBasis: "close",
    });
  });

  it("follows account base when override is null", () => {
    expect(resolveDisplayCurrency("HKD")).toBe("HKD");
  });

  it("uses explicit display currency when set", () => {
    useDisplayPrefs.getState().setDisplayCurrency("TWD");
    expect(resolveDisplayCurrency("HKD")).toBe("TWD");
  });

  it("can clear back to account base", () => {
    useDisplayPrefs.getState().setDisplayCurrency("EUR");
    useDisplayPrefs.getState().setDisplayCurrency(null);
    expect(resolveDisplayCurrency("HKD")).toBe("HKD");
  });
});

describe("privacy mode", () => {
  beforeEach(() => {
    localStorage.removeItem(DISPLAY_PREFS_STORAGE_KEY);
    useDisplayPrefs.setState({
      displayCurrency: null,
      privacyMode: false,
      timezone: "America/New_York",
      timeFormat: "h12",
      tradeDateBasis: "close",
    });
  });

  it("toggles privacy mode on and off", () => {
    expect(useDisplayPrefs.getState().privacyMode).toBe(false);
    useDisplayPrefs.getState().togglePrivacyMode();
    expect(useDisplayPrefs.getState().privacyMode).toBe(true);
    useDisplayPrefs.getState().togglePrivacyMode();
    expect(useDisplayPrefs.getState().privacyMode).toBe(false);
  });
});

describe("timezone preference", () => {
  beforeEach(() => {
    localStorage.removeItem(DISPLAY_PREFS_STORAGE_KEY);
    useDisplayPrefs.setState({
      displayCurrency: null,
      privacyMode: false,
      timezone: "America/New_York",
      timeFormat: "h23",
    });
  });

  it("defaults to US Eastern and can switch to local", () => {
    expect(useDisplayPrefs.getState().timezone).toBe("America/New_York");
    useDisplayPrefs.getState().setTimezone("local");
    expect(useDisplayPrefs.getState().timezone).toBe("local");
    expect(resolveDisplayTimezone("local")).toBeTruthy();
    expect(resolveDisplayTimezone("Asia/Hong_Kong")).toBe("Asia/Hong_Kong");
  });

  it("prefixes select options with UTC± offset", () => {
    // Fixed winter date so US zones are standard time (no DST).
    const winter = new Date("2026-01-15T12:00:00Z");
    expect(formatUtcOffsetPrefix("Asia/Hong_Kong", winter)).toBe("UTC+08");
    expect(formatUtcOffsetPrefix("America/New_York", winter)).toBe("UTC-05");
    expect(formatUtcOffsetPrefix("UTC", winter)).toBe("UTC+00");
    const opts = timezoneSelectOptions(winter);
    expect(opts.find((o) => o.value === "Asia/Hong_Kong")?.label).toBe("UTC+08 Hong Kong");
    expect(opts.find((o) => o.value === "America/New_York")?.label).toBe(
      "UTC-05 Eastern (New York)",
    );
    expect(opts.find((o) => o.value === "UTC")?.label).toBe("UTC+00");
    expect(opts.find((o) => o.value === "local")?.label).toMatch(/^UTC[+-]\d{2} Local \(.+\)$/);
  });

  it("relabels UTC hour keys for display without changing the key semantics", () => {
    const winter = new Date("2026-01-15T12:00:00Z");
    // 14:00 UTC → 22:00 HKT (24h)
    expect(formatUtcHourLabel("14:00", "Asia/Hong_Kong", winter, "h23")).toBe("22:00");
    // 14:00 UTC → 09:00 ET (winter)
    expect(formatUtcHourLabel("14:00", "America/New_York", winter, "h23")).toBe("09:00");
    expect(formatUtcHourLabel("14:00", "UTC", winter, "h23")).toBe("14:00");
  });

  it("relabels UTC hour keys in 12-hour format", () => {
    const winter = new Date("2026-01-15T12:00:00Z");
    expect(formatUtcHourLabel("14:00", "Asia/Hong_Kong", winter, "h12")).toMatch(/10:00\s*PM/i);
  });
});

describe("time format preference", () => {
  beforeEach(() => {
    localStorage.removeItem(DISPLAY_PREFS_STORAGE_KEY);
    useDisplayPrefs.setState({
      displayCurrency: null,
      privacyMode: false,
      timezone: "America/New_York",
      timeFormat: "h12",
      tradeDateBasis: "close",
    });
  });

  it("defaults to 12-hour and can switch to 24-hour", () => {
    expect(useDisplayPrefs.getState().timeFormat).toBe("h12");
    useDisplayPrefs.getState().setTimeFormat("h23");
    expect(useDisplayPrefs.getState().timeFormat).toBe("h23");
  });
});

describe("trade date basis preference", () => {
  beforeEach(() => {
    localStorage.removeItem(DISPLAY_PREFS_STORAGE_KEY);
    useDisplayPrefs.setState({
      displayCurrency: null,
      privacyMode: false,
      timezone: "America/New_York",
      timeFormat: "h12",
      tradeDateBasis: "close",
    });
  });

  it("defaults to close and can switch to open", () => {
    expect(useDisplayPrefs.getState().tradeDateBasis).toBe("close");
    useDisplayPrefs.getState().setTradeDateBasis("open");
    expect(useDisplayPrefs.getState().tradeDateBasis).toBe("open");
  });
});
