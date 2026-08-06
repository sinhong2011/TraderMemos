/**
 * Account-level preferences, kept in step with the server. Mirrors web's
 * `lib/prefsSync.ts` — same keys, same wire shape, same merge rules.
 *
 * What syncs is the set of preferences that decides what the numbers *are*:
 * the market timezone alone decides which calendar day a trade lands on, so a
 * phone and a laptop disagreeing about it means they disagree about last
 * Friday. The display timezone, clock format, date basis and currency are the
 * same argument one step down, and the screenshots cap is a rule about the
 * journal rather than about the device.
 *
 * Appearance and privacy mode deliberately stay local. Light/dark follows the
 * phone you are holding, and privacy mode following the account would un-hide
 * amounts on a screen someone is reading over your shoulder because a laptop
 * elsewhere turned it off.
 */

import {
  applyDisplayPrefs,
  getPrefs,
  parseDisplayPrefsPatch,
  type DisplayPrefs,
} from '@/lib/prefs';
import { applyJournalPrefs, getJournalPrefs, type JournalPrefs } from '@/lib/journal-prefs';

/** Free-form on the wire: the server stores the object without reading it. */
export type SyncedPrefs = Record<string, unknown>;

export type PreferencesResponse = {
  prefs: SyncedPrefs;
  /** Absent until this account has synced something. */
  updated_at?: string;
};

export const SYNCED_PREF_KEYS = [
  'displayCurrency',
  'timezone',
  'marketTimezone',
  'timeFormat',
  'tradeDateBasis',
  'maxScreenshotsPerTrade',
] as const;

export type SyncedPrefKey = (typeof SYNCED_PREF_KEYS)[number];

/** The synced slice of both stores, as the wire object. */
export function localPrefsSnapshot(): SyncedPrefs {
  const d = getPrefs();
  return {
    displayCurrency: d.displayCurrency,
    timezone: d.timezone,
    marketTimezone: d.marketTimezone,
    timeFormat: d.timeFormat,
    tradeDateBasis: d.tradeDateBasis,
    maxScreenshotsPerTrade: getJournalPrefs().maxScreenshotsPerTrade,
  };
}

/**
 * Write server values into the stores. Validation goes through the same
 * parser the app-config import uses, which drops keys it cannot honour rather
 * than defaulting them — a newer client may know a timezone this build does
 * not, and resetting the user's clock over it would be worse than ignoring it.
 *
 * `appearance` and `privacyMode` are stripped even if a future client stores
 * them: what syncs is decided here, not by whatever is in the blob.
 */
export function applyRemotePrefs(remote: SyncedPrefs): void {
  const display = parseDisplayPrefsPatch(remote) as Partial<DisplayPrefs>;
  delete display.appearance;
  delete display.privacyMode;
  applyDisplayPrefs(display);

  if ('maxScreenshotsPerTrade' in remote) {
    const value = remote.maxScreenshotsPerTrade;
    if (value === null || typeof value === 'number') {
      // The store clamps: below 1 or non-finite becomes "no cap".
      applyJournalPrefs({ maxScreenshotsPerTrade: value } as Partial<JournalPrefs>);
    }
  }
}

/** Keys whose local value differs from `previous` — what a PATCH should carry. */
export function changedPrefs(previous: SyncedPrefs, next: SyncedPrefs): SyncedPrefs {
  const patch: SyncedPrefs = {};
  for (const key of SYNCED_PREF_KEYS) {
    if (next[key] !== previous[key]) patch[key] = next[key];
  }
  return patch;
}

/** Keys this account has never stored — the first device to sign in seeds them. */
export function unseededPrefs(remote: SyncedPrefs, local: SyncedPrefs): SyncedPrefs {
  const patch: SyncedPrefs = {};
  for (const key of SYNCED_PREF_KEYS) {
    if (!(key in remote)) patch[key] = local[key];
  }
  return patch;
}

/** Sit on a change before pushing — spinning a picker costs one request. */
export const PREFS_PUSH_DELAY_MS = 600;
