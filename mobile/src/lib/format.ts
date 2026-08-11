/**
 * Number and date formatting shared across screens.
 *
 * Missing numeric values render as formatted zeros ("$0.00", "0.0%") — never a
 * dash placeholder. Truly-absent data (open trade's close time, no top symbol)
 * gets a contextual word at the call site instead.
 *
 * ## Prefs-dependent formatters must come from `useFormatters()`
 *
 * Money masking (privacy mode) and the clock/timezone prefs are read from the
 * store at call time, which makes them invisible to React Compiler: it caches
 * `formatPnl(trade.net_pnl, currency)` on the arguments alone, so a component
 * re-rendered by a privacy flip is handed back the string formatted *before*
 * the flip and the screen never changes. Subscribing with `useDisplayPrefs()`
 * does not fix it — the subscription re-runs the component, the memo cache
 * still answers.
 *
 * `useFormatters()` returns the same formatters bound to the current prefs, so
 * they change identity whenever the prefs do — an argument the compiler *can*
 * see, which invalidates every value derived from them. Inside a component,
 * take `formatPnl` / `formatPnlCompact` / `formatCurrency` / `formatDate` /
 * `formatDayKey` / `formatTime` / `formatHourKeyLabel` from that hook. The
 * module-level exports stay for non-React callers (module scope, event
 * handlers, plain helpers) and for the pure formatters below — percent, ratio,
 * duration and compact counts read no prefs and are safe to import directly.
 */

import { useMemo } from 'react';

import {
  formatHourKeyLabel as hourKeyLabel,
  getPrefs,
  PRIVACY_MASK,
  resolveDisplayTimezone,
  useDisplayPrefs,
  type DisplayPrefs,
} from '@/lib/prefs';

// ---------------------------------------------------------------------------
// Prefs-dependent formatters
//
// Each takes the prefs explicitly so the binding in `useFormatters` is
// structural: there is no way to hand back a stale closure without also
// handing back stale prefs.
// ---------------------------------------------------------------------------

/** Signed currency, e.g. `+$1,240.50` / `-$310.00`. */
function pnl(prefs: DisplayPrefs, value: number | null | undefined, currency: string): string {
  if (prefs.privacyMode) return PRIVACY_MASK;
  const v = value ?? 0;
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Math.abs(v));
  if (v === 0) return formatted;
  return `${v > 0 ? '+' : '-'}${formatted}`;
}

/**
 * Signed compact currency for dense surfaces, e.g. `+$12.3K` / `-$310`.
 * Hermes ignores `notation: 'compact'` (and pads a stray ".0"), so the
 * abbreviation is hand-rolled.
 */
function pnlCompact(
  prefs: DisplayPrefs,
  value: number | null | undefined,
  currency: string,
): string {
  if (prefs.privacyMode) return PRIVACY_MASK;
  const v = value ?? 0;
  const abs = Math.abs(v);
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  const money = (n: number, digits: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }).format(n);
  if (abs >= 1_000_000) return `${sign}${money(abs / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${sign}${money(abs / 1_000, 1)}K`;
  return `${sign}${money(abs, 1)}`;
}

function currencyAmount(
  prefs: DisplayPrefs,
  value: number | null | undefined,
  currency: string,
): string {
  if (prefs.privacyMode) return PRIVACY_MASK;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value ?? 0);
}

function date(prefs: DisplayPrefs, iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: resolveDisplayTimezone(prefs.timezone),
  });
}

/**
 * Formats a bare `YYYY-MM-DD` trading day. Anchored at noon UTC first, because
 * `new Date('2026-05-20')` parses as UTC midnight and the display timezone then
 * pulls it back a day (`May 19` in ET) — same guard as `lib/events.ts`.
 */
function dayKey(prefs: DisplayPrefs, day: string | null | undefined): string {
  if (!day) return '';
  return date(prefs, `${day.slice(0, 10)}T12:00:00Z`);
}

function time(prefs: DisplayPrefs, iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: prefs.timeFormat === 'h12',
    timeZone: resolveDisplayTimezone(prefs.timezone),
  });
}

/**
 * Fixed `yyyy-MM-dd HH:mm:ss` in the display timezone (trade-row corner
 * stamp). en-CA is the locale whose date order is ISO; the clock is always
 * 24-hour — a fixed-width pattern, deliberately outside the 12/24h pref.
 */
function timestamp(prefs: DisplayPrefs, iso: string | null | undefined): string {
  if (!iso) return '';
  const tz = resolveDisplayTimezone(prefs.timezone);
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-CA', { timeZone: tz });
  const clock = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: tz,
  });
  return `${day} ${clock}`;
}

// ---------------------------------------------------------------------------
// Ambient exports — the prefs are read from the store at call time. Correct
// outside React; inside a component use `useFormatters()` (see the file note).
// ---------------------------------------------------------------------------

export function formatPnl(value: number | null | undefined, currency = 'USD'): string {
  return pnl(getPrefs(), value, currency);
}

export function formatPnlCompact(value: number | null | undefined, currency = 'USD'): string {
  return pnlCompact(getPrefs(), value, currency);
}

export function formatCurrency(value: number | null | undefined, currency = 'USD'): string {
  return currencyAmount(getPrefs(), value, currency);
}

export function formatDate(iso: string | null | undefined): string {
  return date(getPrefs(), iso);
}

export function formatDayKey(day: string | null | undefined): string {
  return dayKey(getPrefs(), day);
}

export function formatTime(iso: string | null | undefined): string {
  return time(getPrefs(), iso);
}

export function formatTimestamp(iso: string | null | undefined): string {
  return timestamp(getPrefs(), iso);
}

// ---------------------------------------------------------------------------
// Bound formatters
// ---------------------------------------------------------------------------

export type MoneyFormatter = (value: number | null | undefined, currency?: string) => string;
export type DateFormatter = (iso: string | null | undefined) => string;

/** The prefs-dependent formatters, bound to one prefs snapshot. */
export type Formatters = {
  formatPnl: MoneyFormatter;
  formatPnlCompact: MoneyFormatter;
  formatCurrency: MoneyFormatter;
  formatDate: DateFormatter;
  formatDayKey: DateFormatter;
  formatTime: DateFormatter;
  /** Fixed `yyyy-MM-dd HH:mm:ss` in the display timezone. */
  formatTimestamp: DateFormatter;
  /** Hour bucket key (`"14:00"`) on the 12/24-hour clock pref. */
  formatHourKeyLabel: (hourKey: string) => string;
};

/** Build the bundle for a prefs snapshot — also the seam for tests. */
export function makeFormatters(prefs: DisplayPrefs): Formatters {
  return {
    formatPnl: (value, currency = 'USD') => pnl(prefs, value, currency),
    formatPnlCompact: (value, currency = 'USD') => pnlCompact(prefs, value, currency),
    formatCurrency: (value, currency = 'USD') => currencyAmount(prefs, value, currency),
    formatDate: (iso) => date(prefs, iso),
    formatDayKey: (day) => dayKey(prefs, day),
    formatTime: (iso) => time(prefs, iso),
    formatTimestamp: (iso) => timestamp(prefs, iso),
    formatHourKeyLabel: (key) => hourKeyLabel(key, prefs.timeFormat),
  };
}

/**
 * Formatters for the current display prefs. Subscribes, so a privacy flip or a
 * timezone change re-renders the caller *and* invalidates the values it derived
 * from these functions. Destructure the ones you need:
 *
 *     const { formatPnl, formatDate } = useFormatters();
 */
export function useFormatters(): Formatters {
  const prefs = useDisplayPrefs();
  return useMemo(() => makeFormatters(prefs), [prefs]);
}

// ---------------------------------------------------------------------------
// Pure formatters — no prefs, safe to import anywhere
// ---------------------------------------------------------------------------

/** `win_rate` arrives as a fraction (0–1) from the Go API. */
export function formatPercent(fraction: number | null | undefined, digits = 1): string {
  return `${((fraction ?? 0) * 100).toFixed(digits)}%`;
}

/** `return_pct` arrives already in percent points (`net / base * 100` in Go). */
export function formatPercentPoints(value: number | null | undefined, digits = 2): string {
  return `${(value ?? 0).toFixed(digits)}%`;
}

export function formatRatio(value: number | null | undefined, digits = 2): string {
  if (value == null) return (0).toFixed(digits);
  // Profit factor with zero losses divides to Infinity — that's "all wins", not zero.
  if (!Number.isFinite(value)) return '∞';
  return value.toFixed(digits);
}

/** Compact large counts, e.g. 1.4M / 38k — per the native UI guidelines. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

/** `time_in_trade_secs` -> `1h 12m` / `4m 30s`. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}
