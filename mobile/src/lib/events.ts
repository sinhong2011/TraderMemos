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

/** Sunday of the week a day-key falls in — the inverse of [weekStartKey] for a
 *  day you already have, used to say which week a scrolled-to row belongs to. */
export function weekStartOf(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

export function addDaysKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * "Aug 2 – 8" (or "Dec 28, 2025 – Jan 3, 2026" outside the current year).
 *
 * Intl's `formatRange` collapses the shared month/year per locale rules, but
 * Hermes doesn't implement it (`undefined is not a function`), so fall back to
 * formatting each end and collapsing the month ourselves. Never combine `day`
 * with `year` alone — Intl has no such skeleton and emits "2025 (day: 8)".
 */
/**
 * "Aug", "Jul – Aug", or "Dec 2025 – Jan 2026" — the month scale of a week, for
 * places that already show the day numbers separately and only need to say
 * which month those numbers belong to.
 */
export function formatWeekMonths(weekStart: string, locale: string, todayKey: string): string {
  const endKey = addDaysKey(weekStart, 6);
  const currentYear = todayKey.slice(0, 4);
  const showYear = weekStart.slice(0, 4) !== currentYear || endKey.slice(0, 4) !== currentYear;
  const month = (key: string) =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, {
      month: 'short',
      ...(showYear ? { year: 'numeric' as const } : {}),
      timeZone: 'UTC',
    });
  const from = month(weekStart);
  const to = month(endKey);
  return from === to ? from : `${from} – ${to}`;
}

export function formatWeekLabel(weekStart: string, locale: string, todayKey: string): string {
  const endKey = addDaysKey(weekStart, 6);
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(`${endKey}T12:00:00Z`);
  const currentYear = todayKey.slice(0, 4);
  const showYear = weekStart.slice(0, 4) !== currentYear || endKey.slice(0, 4) !== currentYear;
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    ...(showYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  };

  const dtf = new Intl.DateTimeFormat(locale, opts);
  if (typeof dtf.formatRange === 'function') return dtf.formatRange(start, end);

  // Same month and no year to place → drop the repeated month from the end.
  const sameMonth = !showYear && weekStart.slice(0, 7) === endKey.slice(0, 7);
  const endLabel = sameMonth
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' }).format(end)
    : dtf.format(end);
  return `${dtf.format(start)} – ${endLabel}`;
}
