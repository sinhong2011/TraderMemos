import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { getCustomApiBaseUrl, setBaseUrl } from "./api/client";
import {
  APP_CONFIG_EXPORT_VERSION,
  applyParsedAppConfig,
  buildAppConfigExport,
  parseAppConfig,
} from "./appConfig";
import { useDisplayPrefs } from "./displayPrefs";
import { useJournalPrefs } from "./journalPrefs";

afterEach(() => {
  vi.restoreAllMocks();
  setBaseUrl("");
  useDisplayPrefs.setState({
    displayCurrency: null,
    privacyMode: false,
    timezone: "America/New_York",
    timeFormat: "h12",
    tradeDateBasis: "close",
  });
  useJournalPrefs.setState({ maxScreenshotsPerTrade: null });
});

describe("appConfig", () => {
  it("builds a serializable app config export payload", () => {
    setBaseUrl("https://journal.example.com");
    useDisplayPrefs.getState().setTimezone("Asia/Hong_Kong");
    useDisplayPrefs.getState().setTimeFormat("h23");
    useDisplayPrefs.getState().setTradeDateBasis("open");
    useJournalPrefs.getState().setMaxScreenshotsPerTrade(8);

    const out = buildAppConfigExport("ja", getCustomApiBaseUrl());
    expect(out.format).toBe("tradermemos.app_config");
    expect(out.version).toBe(APP_CONFIG_EXPORT_VERSION);
    expect(out.locale).toBe("ja");
    expect(out.api_base).toBe("https://journal.example.com/api/v1");
    expect(out.display_prefs).toMatchObject({
      timezone: "Asia/Hong_Kong",
      timeFormat: "h23",
      tradeDateBasis: "open",
    });
    expect(out.journal_prefs.maxScreenshotsPerTrade).toBe(8);
  });

  it("parses a config file and ignores unsupported keys", () => {
    const parsed = parseAppConfig(
      JSON.stringify({
        locale: "ko",
        api_base: "https://example.test/api/v1",
        display_prefs: {
          timezone: "Asia/Tokyo",
          timeFormat: "h23",
          tradeDateBasis: "open",
          ignored: true,
        },
        journal_prefs: { maxScreenshotsPerTrade: 12 },
        something_else: "ignored",
      }),
    );
    expect(parsed).toEqual({
      locale: "ko",
      apiBase: "https://example.test/api/v1",
      displayPrefs: {
        timezone: "Asia/Tokyo",
        timeFormat: "h23",
        tradeDateBasis: "open",
      },
      journalPrefs: { maxScreenshotsPerTrade: 12 },
    });
  });

  it("applies parsed config to stores and api base", async () => {
    const setLocale = vi.fn<(...args: any[]) => any>(async () => {});
    await applyParsedAppConfig(
      {
        locale: "zh-HK",
        apiBase: "https://my-host.test",
        displayPrefs: {
          timezone: "UTC",
          timeFormat: "h23",
          tradeDateBasis: "open",
        },
        journalPrefs: { maxScreenshotsPerTrade: 5 },
      },
      setLocale,
    );

    expect(setLocale).toHaveBeenCalledWith("zh-HK");
    expect(getCustomApiBaseUrl()).toBe("https://my-host.test/api/v1");
    expect(useDisplayPrefs.getState().timezone).toBe("UTC");
    expect(useDisplayPrefs.getState().timeFormat).toBe("h23");
    expect(useDisplayPrefs.getState().tradeDateBasis).toBe("open");
    expect(useJournalPrefs.getState().maxScreenshotsPerTrade).toBe(5);
  });
});
