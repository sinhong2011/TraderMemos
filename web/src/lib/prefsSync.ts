import { preferencesApi, type SyncedPrefs } from "@/lib/api/preferences";
import { DISPLAY_CURRENCIES, useDisplayPrefs, type DisplayCurrencyCode } from "@/lib/displayPrefs";
import { useJournalPrefs } from "@/lib/journalPrefs";

/**
 * Which preferences follow the account rather than the device.
 *
 * These decide what the numbers *are*: the market timezone alone decides which
 * calendar day a trade lands on, so the same journal read on a laptop and a
 * phone must agree or the two disagree about last Friday. The currency, clock
 * format and date basis are the same argument one step down, and the
 * screenshots cap is a rule about the journal, not about the machine.
 *
 * Deliberately absent: theme (a dark room is a property of where you are
 * sitting), privacy mode (same, and syncing it would un-hide amounts on a
 * shared screen from another device), locale, and `updateNotices` — which is
 * about this browser's build, not the account.
 */
export const SYNCED_PREF_KEYS = [
  "displayCurrency",
  "timezone",
  "marketTimezone",
  "timeFormat",
  "tradeDateBasis",
  "maxScreenshotsPerTrade",
] as const;

export type SyncedPrefKey = (typeof SYNCED_PREF_KEYS)[number];

/** The synced slice of both stores, as the wire object. */
export function localPrefsSnapshot(): SyncedPrefs {
  const d = useDisplayPrefs.getState();
  const j = useJournalPrefs.getState();
  return {
    displayCurrency: d.displayCurrency,
    timezone: d.timezone,
    marketTimezone: d.marketTimezone,
    timeFormat: d.timeFormat,
    tradeDateBasis: d.tradeDateBasis,
    maxScreenshotsPerTrade: j.maxScreenshotsPerTrade,
  };
}

function isCurrencyCode(value: unknown): value is DisplayCurrencyCode {
  return typeof value === "string" && (DISPLAY_CURRENCIES as readonly string[]).includes(value);
}

/**
 * Write server values into the stores, through the setters so a hand-edited
 * or newer-client value is validated and falls back to a default rather than
 * wedging the app.
 *
 * The timezone, clock and basis setters already sanitize; `setDisplayCurrency`
 * does not, so the code is checked here — the server stores whatever a client
 * sends it, and a future client may know currencies this one does not.
 */
export function applyRemotePrefs(remote: SyncedPrefs): void {
  const d = useDisplayPrefs.getState();
  const j = useJournalPrefs.getState();

  if ("displayCurrency" in remote) {
    const v = remote.displayCurrency;
    if (v == null) d.setDisplayCurrency(null);
    else if (isCurrencyCode(v)) d.setDisplayCurrency(v);
  }
  if (typeof remote.timezone === "string") d.setTimezone(remote.timezone as never);
  if (typeof remote.marketTimezone === "string")
    d.setMarketTimezone(remote.marketTimezone as never);
  if (typeof remote.timeFormat === "string") d.setTimeFormat(remote.timeFormat as never);
  if (typeof remote.tradeDateBasis === "string")
    d.setTradeDateBasis(remote.tradeDateBasis as never);
  if ("maxScreenshotsPerTrade" in remote) {
    const v = remote.maxScreenshotsPerTrade;
    j.setMaxScreenshotsPerTrade(v == null ? null : (v as never));
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

/** How long to sit on a change before pushing it — a picker being dragged
 *  through five timezones should cost one request, not five. */
export const PREFS_PUSH_DELAY_MS = 600;

export const preferencesQueryKey = ["me", "preferences"] as const;

export { preferencesApi };
