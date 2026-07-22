import { getDisplayTimeOpts, isPrivacyMode, PRIVACY_MASK } from "./displayPrefs";
import { intlLocale } from "./locale";

function maskedMoney(): string | null {
  return isPrivacyMode() ? PRIVACY_MASK : null;
}

export function fmtMoney(v: number, currency: string, locale: string): string {
  const masked = maskedMoney();
  if (masked) return masked;
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(v);
}

/** Compact axis labels — avoids clipping `$` in narrow Recharts gutters. */
export function fmtMoneyCompact(v: number, currency: string, locale: string): string {
  const masked = maskedMoney();
  if (masked) return masked;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
}
/** Short day label for chart x-axes, e.g. `Jul 9` (honors display timezone). */
export function fmtDayShort(iso: string, locale: string): string {
  const { timeZone } = getDisplayTimeOpts();
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    timeZone,
  });
}
export function fmtSignedMoney(v: number, currency: string, locale: string): string {
  const masked = maskedMoney();
  if (masked) return masked;
  const s = fmtMoney(Math.abs(v), currency, locale);
  return v < 0 ? `-${s}` : `+${s}`;
}

/** Compact signed money for dense calendar / week cells, e.g. `+$1.5K`. */
export function fmtSignedMoneyCompact(v: number, currency: string, locale: string): string {
  const masked = maskedMoney();
  if (masked) return masked;
  const s = fmtMoneyCompact(Math.abs(v), currency, locale);
  if (v < 0) return `-${s}`;
  if (v > 0) return `+${s}`;
  return s;
}
export function fmtPct(ratio: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(ratio);
}

export function fmtDuration(secs: number | null | undefined): string {
  if (secs == null || secs <= 0) return "-";
  if (secs < 3600) return `${Math.max(1, Math.round(secs / 60))}m`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h`;
  return `${Math.round(secs / 86400)}d`;
}

export function fmtDateShort(iso: string | null): string {
  if (!iso) return "-";
  // Prefer the calendar date from the ISO string to avoid timezone day-shift.
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  if (m) return m[1];
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Time-of-day for timestamps (honors display timezone + 12/24h). */
export function fmtTime(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const loc = locale ?? intlLocale();
  const { timeZone, hour12 } = getDisplayTimeOpts();
  return d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit", timeZone, hour12 });
}

/** Human-readable date/time for modals and detail views. Falls back to raw string when unparseable. */
export function fmtDateTime(iso: string | null | undefined, locale?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const loc = locale ?? intlLocale();
  const { timeZone, hour12 } = getDisplayTimeOpts();
  const hasTime = /T|\d:\d/.test(iso);
  if (!hasTime) {
    return d.toLocaleDateString(loc, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone,
    });
  }
  return d.toLocaleString(loc, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    hour12,
  });
}

export function fmtRecord(wins: number, losses: number): string {
  const parts: string[] = [];
  if (wins > 0) parts.push(`${wins}W`);
  if (losses > 0) parts.push(`${losses}L`);
  return parts.length > 0 ? parts.join("") : "-";
}
