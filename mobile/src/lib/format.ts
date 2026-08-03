/**
 * Number and date formatting shared across screens.
 *
 * Missing numeric values render as formatted zeros ("$0.00", "0.0%") — never a
 * dash placeholder. Truly-absent data (open trade's close time, no top symbol)
 * gets a contextual word at the call site instead.
 */

/** Signed currency, e.g. `+$1,240.50` / `-$310.00`. */
export function formatPnl(value: number | null | undefined, currency = 'USD'): string {
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
export function formatPnlCompact(value: number | null | undefined, currency = 'USD'): string {
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

export function formatCurrency(value: number | null | undefined, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value ?? 0);
}

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

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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
