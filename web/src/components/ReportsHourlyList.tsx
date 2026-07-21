import type { BreakGroup } from "../lib/api/types";
import { cn } from "../lib/cn";
import { usePrivacyMode } from "../lib/displayPrefs";
import { fmtPct, fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { pnlColor } from "./theme-tokens";

export interface ReportsHourlyListProps {
  breakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
  currency: string;
  fxRate?: number;
}

/** Tradervue-style hourly list with magnitude bars. */
export function ReportsHourlyList({
  breakdown,
  loading,
  error,
  currency,
  fxRate = 1,
}: ReportsHourlyListProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const maxAbs = Math.max(...breakdown.map((g) => Math.abs(g.summary.net_pnl)), 1);

  return (
    <section className="flex min-h-0 min-w-0 flex-col rounded-card bg-bg-panel p-3">
      <p className="text-[10px] font-semibold tracking-wide text-signal">Hourly</p>
      {loading ? (
        <Skeleton height="200px" className="mt-3" />
      ) : error ? (
        <p className="mt-3 text-xs text-loss">Failed to load hourly breakdown.</p>
      ) : breakdown.length === 0 ? (
        <div className="mt-2">
          <EmptyState title="No data" hint="Add trades to see hourly performance." />
        </div>
      ) : (
        <ul className="mt-3 flex max-h-[280px] flex-col gap-2 overflow-y-auto [scrollbar-width:thin]">
          {[...breakdown]
            .sort((a, b) => Math.abs(b.summary.net_pnl) - Math.abs(a.summary.net_pnl))
            .map((g) => {
              const pnl = g.summary.net_pnl * fxRate;
              const width = (Math.abs(g.summary.net_pnl) / maxAbs) * 100;
              return (
                <li key={g.key} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-medium text-text-muted">{g.key}</span>
                    <span className="flex items-baseline gap-2">
                      <span className={cn("text-[12px] font-semibold tabular-nums", pnlColor(pnl))}>
                        {fmtSignedMoney(pnl, currency, locale)}
                      </span>
                      <span className="text-[10px] tabular-nums text-text-dim">
                        {fmtPct(g.summary.win_rate, locale)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-bg-inset">
                    <div
                      className={cn("h-full rounded-full", pnl >= 0 ? "bg-profit" : "bg-loss")}
                      style={{ width: `${width}%`, opacity: 0.7 }}
                    />
                  </div>
                </li>
              );
            })}
        </ul>
      )}
    </section>
  );
}
