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

/**
 * Today's trading day for a component. Subscribes to the market-timezone pref
 * so React Compiler re-keys the day when it changes — calling
 * `marketTodayKey()` in render would be cached on its (empty) arguments.
 * Routine ticks are keyed by this day on every client and on the server.
 */
export function useMarketToday(): string {
  const pref = useDisplayPrefs((s) => s.marketTimezone);
  return dayKeyInTz(new Date().toISOString(), resolveMarketTimezone(pref));
}
