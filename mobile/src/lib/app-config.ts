/**
 * Local app-config backup — the phone counterpart of web's appConfig.ts.
 * Same envelope (`tradermemos.app_config` v1) so files round-trip between
 * platforms: web reads `api_base` and `display_prefs` from a phone export, the
 * phone reads the same keys back and ignores the web-only sections (locale).
 * No API involved — these are device-local preferences.
 */
import { getJournalPrefs, type JournalPrefs } from '@/lib/journal-prefs';
import { getPrefs, parseDisplayPrefsPatch, type DisplayPrefs } from '@/lib/prefs';

export const APP_CONFIG_FORMAT = 'tradermemos.app_config';
export const APP_CONFIG_EXPORT_VERSION = 1;

export type ParsedAppConfig = {
  apiBase?: string;
  displayPrefs?: Partial<DisplayPrefs>;
  journalPrefs?: Partial<JournalPrefs>;
};

/** Serializes the device-local preferences, ready to write to a .json file. */
export function buildAppConfigExport(serverUrl: string): string {
  const prefs = getPrefs();
  return JSON.stringify(
    {
      format: APP_CONFIG_FORMAT,
      version: APP_CONFIG_EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      api_base: serverUrl,
      // Web's key and field names — `timezone`, `timeFormat` and
      // `tradeDateBasis` are the three it reads back; the rest are phone-only
      // and it drops them.
      display_prefs: {
        appearance: prefs.appearance,
        privacyMode: prefs.privacyMode,
        displayCurrency: prefs.displayCurrency,
        timezone: prefs.timezone,
        marketTimezone: prefs.marketTimezone,
        timeFormat: prefs.timeFormat,
        tradeDateBasis: prefs.tradeDateBasis,
      },
      // Web's home for the screenshots cap, and the right one — it's a
      // journaling rule, not a formatting pref.
      journal_prefs: { maxScreenshotsPerTrade: getJournalPrefs().maxScreenshotsPerTrade },
    },
    null,
    2,
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Lenient validation, mirroring web parseAppConfig: unknown fields are
 * dropped, a file with nothing applicable is rejected with a readable error.
 */
export function parseAppConfig(content: string): ParsedAppConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error('Invalid JSON file.');
  }
  if (!isObject(raw)) throw new Error('Invalid app config format.');

  const parsed: ParsedAppConfig = {};
  if (typeof raw.api_base === 'string' && raw.api_base !== '') parsed.apiBase = raw.api_base;
  const prefs = parseDisplayPrefsPatch(raw.display_prefs);
  if (Object.keys(prefs).length > 0) parsed.displayPrefs = prefs;
  if (isObject(raw.journal_prefs)) {
    const max = raw.journal_prefs.maxScreenshotsPerTrade;
    if (max === null || typeof max === 'number') {
      // The store clamps: anything below 1 or non-finite becomes "no cap".
      parsed.journalPrefs = { maxScreenshotsPerTrade: max };
    }
  }

  if (
    parsed.apiBase === undefined &&
    parsed.displayPrefs === undefined &&
    parsed.journalPrefs === undefined
  ) {
    throw new Error('No supported settings found in this file.');
  }
  return parsed;
}
