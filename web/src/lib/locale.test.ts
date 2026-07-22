import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_LOCALE,
  getIntlLocale,
  getStoredLocale,
  isAppLocale,
  LOCALE_OPTIONS,
  navLabel,
  settingsLabel,
  setStoredLocale,
} from "./locale";

describe("locale", () => {
  it("maps app locales to Intl tags", () => {
    expect(getIntlLocale("en")).toBe("en-US");
    expect(getIntlLocale("zh-HK")).toBe("zh-HK");
    expect(getIntlLocale("ja")).toBe("ja-JP");
    expect(getIntlLocale("ko")).toBe("ko-KR");
    expect(getIntlLocale("unknown")).toBe("en-US");
  });

  it("validates supported locales", () => {
    expect(isAppLocale("en")).toBe(true);
    expect(isAppLocale("zh-HK")).toBe(true);
    expect(isAppLocale("ja")).toBe(true);
    expect(isAppLocale("ko")).toBe(true);
    expect(isAppLocale("fr")).toBe(false);
  });

  it("persists locale in localStorage", () => {
    setStoredLocale("ja");
    expect(getStoredLocale()).toBe("ja");
    setStoredLocale(DEFAULT_LOCALE);
    expect(getStoredLocale()).toBe("en");
  });

  it("translates navigation labels", () => {
    expect(navLabel("ja", "dashboard")).toBe("ダッシュボード");
    expect(navLabel("ko", "trades")).toBe("거래");
    expect(navLabel("zh-HK", "settings")).toBe("設定");
  });

  it("translates settings navigation labels", () => {
    expect(settingsLabel("ja", "accounts")).toBe("アカウント");
    expect(settingsLabel("zh-HK", "general")).toBe("一般");
    expect(settingsLabel("en", "ai")).toBe("AI");
    expect(settingsLabel("en", "aiTitle")).toBe("AI & LLM");
    expect(settingsLabel("en", "about")).toBe("About");
    expect(settingsLabel("ja", "aboutTitle")).toBe("TraderMemos について");
  });

  it("exposes all language options", () => {
    expect(LOCALE_OPTIONS.map((o) => o.value)).toEqual(["en", "zh-HK", "ja", "ko"]);
  });
});
