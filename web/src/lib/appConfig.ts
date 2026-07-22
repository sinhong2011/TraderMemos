import { setBaseUrl } from "./api/client";
import {
  TIMEZONE_CHOICES,
  type TimeFormatPref,
  type TimezonePref,
  type TradeDateBasis,
  useDisplayPrefs,
} from "./displayPrefs";
import { useJournalPrefs, type MaxScreenshots } from "./journalPrefs";
import { isAppLocale, type AppLocale } from "./locale";

export const APP_CONFIG_EXPORT_VERSION = 1;

type DisplayPrefsExport = {
  timezone: TimezonePref;
  timeFormat: TimeFormatPref;
  tradeDateBasis: TradeDateBasis;
};

type JournalPrefsExport = {
  maxScreenshotsPerTrade: MaxScreenshots;
};

export type AppConfigExport = {
  format: "tradermemos.app_config";
  version: number;
  exported_at: string;
  locale: AppLocale;
  api_base: string;
  display_prefs: DisplayPrefsExport;
  journal_prefs: JournalPrefsExport;
};

export type ParsedAppConfig = {
  locale?: AppLocale;
  apiBase?: string;
  displayPrefs?: Partial<DisplayPrefsExport>;
  journalPrefs?: Partial<JournalPrefsExport>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTimeFormatPref(value: unknown): value is TimeFormatPref {
  return value === "h12" || value === "h23";
}

function isTradeDateBasis(value: unknown): value is TradeDateBasis {
  return value === "close" || value === "open";
}

function isTimezonePref(value: unknown): value is TimezonePref {
  return typeof value === "string" && TIMEZONE_CHOICES.some((choice) => choice.value === value);
}

function normalizeMaxScreenshots(value: unknown): MaxScreenshots {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.floor(n), 100);
}

export function buildAppConfigExport(
  currentLocale: AppLocale,
  currentApiBase: string,
): AppConfigExport {
  const display = useDisplayPrefs.getState();
  const journal = useJournalPrefs.getState();
  return {
    format: "tradermemos.app_config",
    version: APP_CONFIG_EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    locale: currentLocale,
    api_base: currentApiBase,
    display_prefs: {
      timezone: display.timezone,
      timeFormat: display.timeFormat,
      tradeDateBasis: display.tradeDateBasis,
    },
    journal_prefs: {
      maxScreenshotsPerTrade: journal.maxScreenshotsPerTrade,
    },
  };
}

export function parseAppConfig(content: string): ParsedAppConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("Invalid JSON file.");
  }
  if (!isObject(raw)) throw new Error("Invalid app config format.");

  const parsed: ParsedAppConfig = {};
  if (typeof raw.locale === "string" && isAppLocale(raw.locale)) parsed.locale = raw.locale;
  if (typeof raw.api_base === "string") parsed.apiBase = raw.api_base;

  if (isObject(raw.display_prefs)) {
    parsed.displayPrefs = {
      timezone: isTimezonePref(raw.display_prefs.timezone) ? raw.display_prefs.timezone : undefined,
      timeFormat: isTimeFormatPref(raw.display_prefs.timeFormat)
        ? raw.display_prefs.timeFormat
        : undefined,
      tradeDateBasis: isTradeDateBasis(raw.display_prefs.tradeDateBasis)
        ? raw.display_prefs.tradeDateBasis
        : undefined,
    };
  }

  if (isObject(raw.journal_prefs)) {
    parsed.journalPrefs = {
      maxScreenshotsPerTrade: normalizeMaxScreenshots(raw.journal_prefs.maxScreenshotsPerTrade),
    };
  }

  if (
    !parsed.locale &&
    parsed.apiBase === undefined &&
    !parsed.displayPrefs &&
    !parsed.journalPrefs
  ) {
    throw new Error("No supported settings found in this file.");
  }

  return parsed;
}

export async function applyParsedAppConfig(
  parsed: ParsedAppConfig,
  setLocale: (locale: string) => Promise<void>,
): Promise<void> {
  if (parsed.locale) await setLocale(parsed.locale);
  if (typeof parsed.apiBase === "string") setBaseUrl(parsed.apiBase);

  if (parsed.displayPrefs) {
    const display = useDisplayPrefs.getState();
    if (parsed.displayPrefs.timezone) display.setTimezone(parsed.displayPrefs.timezone);
    if (parsed.displayPrefs.timeFormat) display.setTimeFormat(parsed.displayPrefs.timeFormat);
    if (parsed.displayPrefs.tradeDateBasis)
      display.setTradeDateBasis(parsed.displayPrefs.tradeDateBasis);
  }

  if (parsed.journalPrefs && parsed.journalPrefs.maxScreenshotsPerTrade !== undefined) {
    useJournalPrefs
      .getState()
      .setMaxScreenshotsPerTrade(parsed.journalPrefs.maxScreenshotsPerTrade);
  }
}
