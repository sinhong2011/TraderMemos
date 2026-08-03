/**
 * Local app-config backup — the phone counterpart of web's appConfig.ts.
 * Same envelope (`tradermemos.app_config` v1) so files round-trip between
 * platforms: web reads `api_base` from a phone export; the phone reads its own
 * `mobile_prefs` and ignores web-only sections (locale, display prefs).
 * No API involved — these are device-local preferences.
 */
import { storage } from '@/storage/mmkv';

export const APP_CONFIG_FORMAT = 'tradermemos.app_config';
export const APP_CONFIG_EXPORT_VERSION = 1;

/** MMKV key for the disconnect-confirmation preference (default on). */
export const CONFIRM_DESTRUCTIVE_KEY = 'settings.confirm-destructive';

export type ParsedAppConfig = {
  apiBase?: string;
  confirmDestructive?: boolean;
};

/** Serializes the device-local preferences, ready to write to a .json file. */
export function buildAppConfigExport(serverUrl: string): string {
  return JSON.stringify(
    {
      format: APP_CONFIG_FORMAT,
      version: APP_CONFIG_EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      api_base: serverUrl,
      mobile_prefs: {
        confirmDestructive: storage.getBoolean(CONFIRM_DESTRUCTIVE_KEY) ?? true,
      },
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
  if (isObject(raw.mobile_prefs) && typeof raw.mobile_prefs.confirmDestructive === 'boolean') {
    parsed.confirmDestructive = raw.mobile_prefs.confirmDestructive;
  }

  if (parsed.apiBase === undefined && parsed.confirmDestructive === undefined) {
    throw new Error('No supported settings found in this file.');
  }
  return parsed;
}
