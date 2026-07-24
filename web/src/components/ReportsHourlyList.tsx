import type { BreakGroup } from "../lib/api/types";
import { cn } from "../lib/cn";
import {
  formatUtcHourLabel,
  resolveDisplayTimezone,
  useDisplayPrefs,
  useDisplayTimePrefs,
  usePrivacyMode,
} from "../lib/displayPrefs";
import { fmtPct } from "../lib/format";
import { intlLocale } from "../lib/locale";
import { EmptyState } from "./EmptyState";
import { useReportsMoney } from "./ReportsDisplayContext";
import { Skeleton } from "./Skeleton";
import { pnlColor } from "./theme-tokens";

export interface ReportsHourlyListProps {
  breakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
}

/** Tradervue-style hourly list with magnitude bars. Keys from API are UTC hours. */
export function ReportsHourlyList({ breakdown, loading, error }: ReportsHourlyListProps) {
  usePrivacyMode();
  useDisplayTimePrefs();
  const locale = intlLocale();
  const money = useReportsMoney();
  const timezonePref = useDisplayPrefs((s) => s.timezone);
  const displayTz = resolveDisplayTimezone(timezonePref);
  const maxAbs = Math.max(...breakdown.map((g) => Math.abs(money.pnl(g.summary))), 1);

  return (
    <section className="flex min-h-0 min-w-0 flex-col rounded-lg bg-card p-3">
      <p className="text-[10px] font-semibold tracking-wide text-chart-3">Hourly</p>
      {loading ? (
        <Skeleton height="200px" className="mt-3" />
      ) : error ? (
        <p className="mt-3 text-xs text-destructive">Failed to load hourly breakdown.</p>
      ) : breakdown.length === 0 ? (
        <div className="mt-2">
          <EmptyState title="No data" hint="Add trades to see hourly performance." />
        </div>
      ) : (
        <ul className="mt-3 flex max-h-[280px] flex-col gap-2 overflow-y-auto [scrollbar-width:thin]">
          {[...breakdown]
            .sort((a, b) => Math.abs(money.pnl(b.summary)) - Math.abs(money.pnl(a.summary)))
            .map((g) => {
              const pnl = money.pnl(g.summary);
              const width = (Math.abs(pnl) / maxAbs) * 100;
              return (
                <li key={g.key} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {formatUtcHourLabel(g.key, displayTz)}
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className={cn("text-[12px] font-semibold tabular-nums", pnlColor(pnl))}>
                        {money.format(pnl)}
                      </span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {fmtPct(g.summary.win_rate, locale)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
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
