/**
 * Pure formatters for the Backups block. Everything prefs-dependent (locale,
 * display timezone, 12/24h clock, "now") comes in as an argument: React
 * Compiler memoizes on arguments, so a formatter that read the prefs store
 * itself would keep serving the pre-change string.
 */

/** "3 minutes ago" / "yesterday" style age of an ISO timestamp. */
export function fmtRelativeAge(iso: string, nowMs: number, locale: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const sec = Math.max(0, Math.round((nowMs - then) / 1000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (sec < 45) return rtf.format(0, "second");
  const min = Math.round(sec / 60);
  if (min < 60) return rtf.format(-min, "minute");
  const hr = Math.round(min / 60);
  if (hr < 24) return rtf.format(-hr, "hour");
  return rtf.format(-Math.round(hr / 24), "day");
}

/** Absolute date + time in the display timezone and clock. */
export function fmtBackupTimestamp(
  iso: string,
  locale: string,
  timeZone: string,
  hour12: boolean,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    hour12,
  });
}

/** Compact schedule interval: 1440 → "24h", 90 → "90m", 2880 → "2d". */
export function fmtBackupInterval(minutes: number): string {
  if (minutes <= 0) return "0m";
  if (minutes % 1440 === 0 && minutes > 1440) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}
