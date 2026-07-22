import type { Trade } from "../lib/api/types";
import { cn } from "../lib/cn";
import { useDisplayTimePrefs, usePrivacyMode } from "../lib/displayPrefs";
import { fmtDayShort } from "../lib/format";
import { intlLocale } from "../lib/locale";
import { useReportsMoney } from "./ReportsDisplayContext";
import { pnlColor } from "./theme-tokens";

export interface DayStripItem {
  date: string;
  pnl: number;
  trades: number;
}

/** Closed-trade daily P&L strip, oldest → newest. */
export function buildReportsDayStrip(
  trades: Trade[],
  tradePnl: (t: Trade) => number = (t) => t.net_pnl ?? 0,
): DayStripItem[] {
  const map = new Map<string, { pnl: number; trades: number }>();
  for (const t of trades) {
    if (t.status === "open") continue;
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
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface ReportsDayStripProps {
  trades: Trade[];
  loading?: boolean;
  /** Kept for call-site compatibility; display currency/fx come from ReportsDisplayContext. */
  currency?: string;
  fxRate?: number;
}

export function ReportsDayStrip({ trades, loading }: ReportsDayStripProps) {
  usePrivacyMode();
  useDisplayTimePrefs();
  const money = useReportsMoney();
  const locale = intlLocale();
  const days = buildReportsDayStrip(trades, money.tradePnl);

  if (loading) {
    return (
      <div className="flex gap-1.5 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-[72px] w-[88px] shrink-0 animate-pulse rounded-card bg-bg-panel"
          />
        ))}
      </div>
    );
  }

  if (days.length === 0) return null;

  return (
    <section className="min-w-0">
      <p className="mb-2 text-[10px] font-semibold tracking-wide text-signal">Trading days</p>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {days.map((d) => {
          const dow = new Date(`${d.date}T12:00:00Z`).getUTCDay();
          const isWeekend = dow === 0 || dow === 6;
          return (
            <div
              key={d.date}
              className={cn(
                "flex w-[88px] shrink-0 flex-col rounded-card bg-bg-panel px-2.5 py-2",
                isWeekend && "opacity-60",
              )}
            >
              <p className="text-[10px] font-medium text-text-muted">
                {fmtDayShort(`${d.date}T12:00:00Z`, locale)}
              </p>
              <p
                className={cn(
                  "mt-1.5 text-[13px] font-semibold leading-none tabular-nums tracking-[-0.02em]",
                  pnlColor(d.pnl),
                )}
              >
                {money.format(d.pnl)}
              </p>
              <p className="mt-1 text-[9px] text-text-dim">
                {d.trades} {d.trades === 1 ? "trade" : "trades"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
