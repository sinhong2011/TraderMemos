/**
 * Reports display controls (side / duration / P&L basis / unit / average) and
 * the money logic that honors them — the mobile port of web's
 * ReportsDisplayContext plus the ReportsControlBar state, folded into one
 * MMKV-persisted store since the nav-bar filter menu and the section
 * components live in different subtrees.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Summary, Trade } from '@/api/types';
import { formatPercent, formatPnl, formatPnlCompact } from '@/lib/format';
import { mmkvStorage } from '@/storage/zustand-mmkv';

export type ReportsSide = 'all' | 'long' | 'short';
export type ReportsDuration = 'all' | 'scalp' | 'day' | 'swing';
export type PnlMode = 'net' | 'gross';
export type UnitMode = 'abs' | 'pct';
export type AvgMode = 'mean' | 'median';

export type ReportsControls = {
  side: ReportsSide;
  duration: ReportsDuration;
  pnlMode: PnlMode;
  unitMode: UnitMode;
  /** Mean vs outlier-resistant median for per-trade stats. */
  avgMode: AvgMode;
};

const DEFAULTS: ReportsControls = {
  side: 'all',
  duration: 'all',
  pnlMode: 'net',
  unitMode: 'abs',
  avgMode: 'mean',
};

const PERSIST_KEY = 'store:reports-controls';

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Validate every field — a stale or hand-edited blob never wedges the menu. */
function sanitize(raw: unknown): ReportsControls {
  const parsed = (raw ?? {}) as Record<string, unknown>;
  return {
    side: pick(parsed.side, ['all', 'long', 'short'], DEFAULTS.side),
    duration: pick(parsed.duration, ['all', 'scalp', 'day', 'swing'], DEFAULTS.duration),
    pnlMode: pick(parsed.pnlMode, ['net', 'gross'], DEFAULTS.pnlMode),
    unitMode: pick(parsed.unitMode, ['abs', 'pct'], DEFAULTS.unitMode),
    avgMode: pick(parsed.avgMode, ['mean', 'median'], DEFAULTS.avgMode),
  };
}

const useReportsStore = create<ReportsControls>()(
  persist((): ReportsControls => DEFAULTS, {
    name: PERSIST_KEY,
    storage: mmkvStorage<ReportsControls>(),
    merge: (persisted) => sanitize(persisted),
  }),
);

export function setReportsControls(patch: Partial<ReportsControls>) {
  useReportsStore.setState(patch);
}

export function resetReportsControls() {
  useReportsStore.setState(DEFAULTS);
}

export function useReportsControls(): ReportsControls {
  return useReportsStore();
}

// ---------------------------------------------------------------------------
// Money logic (web useReportsMoney)
// ---------------------------------------------------------------------------

export type ReportsMoney = {
  pnlMode: PnlMode;
  avgMode: AvgMode;
  /** Resolved unit — falls back to abs when no % basis exists. */
  unitMode: UnitMode;
  pctEnabled: boolean;
  /** Summary-level P&L honoring the net/gross basis. */
  pnl: (s: Summary) => number;
  /** Trade-level P&L honoring the net/gross basis. */
  tradePnl: (t: Trade) => number;
  /** Raw base-currency P&L → display value ($-converted or fraction-of-balance). */
  display: (rawPnl: number) => number;
  format: (rawPnl: number) => string;
  formatCompact: (rawPnl: number) => string;
};

/**
 * Build the money helpers for the current controls. `denominator` is the
 * %-basis (sum of starting balances); 0 disables the % unit.
 */
export function reportsMoney(
  controls: ReportsControls,
  currency: string,
  fxRate: number,
  denominator: number,
): ReportsMoney {
  const pctEnabled = denominator > 0;
  const usePct = controls.unitMode === 'pct' && pctEnabled;

  // Gross = before fees. Do NOT use gross_profit - gross_loss here: those are
  // net-classified win/loss sums, so their difference is identically net_pnl
  // and the toggle would be a no-op. Fall back to net + fees for older APIs.
  const pnl = (s: Summary) =>
    controls.pnlMode === 'gross' ? (s.gross_pnl ?? s.net_pnl + s.total_fees) : s.net_pnl;
  const tradePnl = (t: Trade) =>
    controls.pnlMode === 'gross' ? (t.gross_pnl ?? t.net_pnl ?? 0) : (t.net_pnl ?? 0);

  // The % basis stays a base-currency ratio — FX scales both sides equally,
  // so converting the numerator alone (as web does) would skew the fraction.
  const display = (rawPnl: number) => (usePct ? rawPnl / denominator : rawPnl * fxRate);
  const format = (rawPnl: number) =>
    usePct ? formatPercent(rawPnl / denominator) : formatPnl(rawPnl * fxRate, currency);
  const formatCompact = (rawPnl: number) =>
    usePct ? formatPercent(rawPnl / denominator) : formatPnlCompact(rawPnl * fxRate, currency);

  return {
    pnlMode: controls.pnlMode,
    avgMode: controls.avgMode,
    unitMode: usePct ? 'pct' : 'abs',
    pctEnabled,
    pnl,
    tradePnl,
    display,
    format,
    formatCompact,
  };
}

// ---------------------------------------------------------------------------
// Day strip (web buildReportsDayStrip)
// ---------------------------------------------------------------------------

export interface DayStripItem {
  date: string;
  pnl: number;
  trades: number;
}

/** Closed-trade daily P&L strip, newest → oldest. */
export function buildReportsDayStrip(
  trades: Trade[],
  tradePnl: (t: Trade) => number = (t) => t.net_pnl ?? 0,
): DayStripItem[] {
  const map = new Map<string, { pnl: number; trades: number }>();
  for (const t of trades) {
    if (t.status === 'open') continue;
    const pnl = tradePnl(t);
    if (pnl == null || Number.isNaN(pnl)) continue;
    const date = (t.closed_at ?? t.opened_at).slice(0, 10);
    const cur = map.get(date) ?? { pnl: 0, trades: 0 };
    cur.pnl += pnl;
    cur.trades += 1;
    map.set(date, cur);
  }
  return [...map.entries()]
    .map(([date, s]) => ({
      date,
      pnl: Math.round(s.pnl * 100) / 100,
      trades: s.trades,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Rank label for the SQN system-quality score (web sqnLabel). */
export function sqnBand(sqn: number): 'superb' | 'excellent' | 'good' | 'average' | 'below' | 'poor' {
  if (sqn >= 5) return 'superb';
  if (sqn >= 3) return 'excellent';
  if (sqn >= 2.5) return 'good';
  if (sqn >= 2) return 'average';
  if (sqn >= 1) return 'below';
  return 'poor';
}
