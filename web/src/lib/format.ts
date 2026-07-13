import { intlLocale } from "./locale";

export function fmtMoney(v: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(v);
}

/** Compact axis labels — avoids clipping `$` in narrow Recharts gutters. */
export function fmtMoneyCompact(v: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
}
/** Short day label for chart x-axes, e.g. `Jul 9`. */
export function fmtDayShort(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}
export function fmtSignedMoney(v: number, currency: string, locale: string): string {
  const s = fmtMoney(Math.abs(v), currency, locale);
  return v < 0 ? `-${s}` : `+${s}`;
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
  return new Date(iso).toLocaleDateString(intlLocale());
}

/** Human-readable date/time for modals and detail views. Falls back to raw string when unparseable. */
export function fmtDateTime(iso: string | null | undefined, locale?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const loc = locale ?? intlLocale();
  const hasTime = /T|\d:\d/.test(iso);
  if (!hasTime) {
    return d.toLocaleDateString(loc, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return d.toLocaleString(loc, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtRecord(wins: number, losses: number): string {
  const parts: string[] = [];
  if (wins > 0) parts.push(`${wins}W`);
  if (losses > 0) parts.push(`${losses}L`);
  return parts.length > 0 ? parts.join("") : "-";
}
