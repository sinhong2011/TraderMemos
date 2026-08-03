/**
 * Economic-calendar week math, ported from web EconomicEventsView helpers.
 * All keys are `YYYY-MM-DD` on the trader's display clock; the fetch window
 * pads a day on each edge so UTC-boundary events don't fall out of the week.
 */

/** Calendar day of an instant in a timezone, as `YYYY-MM-DD`. */
export function dayKeyInTz(iso: string, timeZone?: string): string {
  if (!timeZone) return iso.slice(0, 10);
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Sunday day-key of the week `offsetWeeks` from today, on the trader's clock. */
export function weekStartKey(offsetWeeks: number, timeZone?: string): string {
  const todayKey = dayKeyInTz(new Date().toISOString(), timeZone);
  const base = new Date(`${todayKey}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() - base.getUTCDay() + offsetWeeks * 7);
  return base.toISOString().slice(0, 10);
}

export function addDaysKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * "Aug 2 – 8" (or "Jul 26 – Aug 1, 2025" outside the current year) — Intl's
 * `formatRange` collapses the shared month/year per locale rules; formatting
 * the two ends separately yields garbage in some locales, so let Intl own it.
 */
export function formatWeekLabel(weekStart: string, locale: string, todayKey: string): string {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(`${addDaysKey(weekStart, 6)}T12:00:00Z`);
  const currentYear = todayKey.slice(0, 4);
  const showYear =
    weekStart.slice(0, 4) !== currentYear || addDaysKey(weekStart, 6).slice(0, 4) !== currentYear;
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(showYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).formatRange(start, end);
}
