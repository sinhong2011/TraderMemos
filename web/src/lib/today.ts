import { dayKeyInTz } from "./calendar";
import { resolveMarketTimezone, useDisplayPrefs } from "./displayPrefs";

/**
 * Today's trading day (`YYYY-MM-DD`) on the market clock — the same key the
 * calendar and day review bucket trades by, never the browser's local date.
 */
export function marketTodayKey(now: Date = new Date()): string {
  const tz = resolveMarketTimezone(useDisplayPrefs.getState().marketTimezone);
  return dayKeyInTz(now.toISOString(), tz);
}
