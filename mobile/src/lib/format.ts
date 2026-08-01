/** Number and date formatting shared across screens. */

/** Signed currency, e.g. `+$1,240.50` / `-$310.00`. */
export function formatPnl(value: number | null | undefined, currency = 'USD'): string {
  if (value == null) return '—';
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  if (value === 0) return formatted;
  return `${value > 0 ? '+' : '-'}${formatted}`;
}

/** Signed compact currency for dense surfaces, e.g. `+$1.2K` / `-$310`. */
export function formatPnlCompact(value: number | null | undefined, currency = 'USD'): string {
  if (value == null) return '—';
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  if (value === 0) return formatted;
  return `${value > 0 ? '+' : '-'}${formatted}`;
}

export function formatCurrency(value: number | null | undefined, currency = 'USD'): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

/** `win_rate` arrives as a fraction (0–1) from the Go API. */
export function formatPercent(fraction: number | null | undefined, digits = 1): string {
  if (fraction == null) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** `return_pct` arrives already in percent points (`net / base * 100` in Go). */
export function formatPercentPoints(value: number | null | undefined, digits = 2): string {
  if (value == null) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatRatio(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

/** Compact large counts, e.g. 1.4M / 38k — per the native UI guidelines. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** `time_in_trade_secs` -> `1h 12m` / `4m 30s`. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}
