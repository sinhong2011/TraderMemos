import { describe, expect, it, beforeEach } from "vite-plus/test";
import {
  accountBaseCurrency,
  DISPLAY_PREFS_STORAGE_KEY,
  resolveDisplayCurrency,
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
    useDisplayPrefs.setState({ displayCurrency: null, privacyMode: false });
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
    useDisplayPrefs.setState({ displayCurrency: null, privacyMode: false });
  });

  it("toggles privacy mode on and off", () => {
    expect(useDisplayPrefs.getState().privacyMode).toBe(false);
    useDisplayPrefs.getState().togglePrivacyMode();
    expect(useDisplayPrefs.getState().privacyMode).toBe(true);
    useDisplayPrefs.getState().togglePrivacyMode();
    expect(useDisplayPrefs.getState().privacyMode).toBe(false);
  });
});
