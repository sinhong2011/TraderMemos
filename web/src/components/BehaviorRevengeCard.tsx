import type { BehaviorReport } from "@/lib/api/types";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtDayShort, fmtPct } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Pill } from "./Pill";
import { useReportsMoney } from "./ReportsDisplayContext";
import { Skeleton } from "./Skeleton";
import { StatCard } from "./StatCard";

export interface BehaviorRevengeCardProps {
  report?: BehaviorReport;
  loading: boolean;
  error: boolean;
  onSelectTradeId?: (id: string) => void;
}

/**
 * "What does trading angry cost me?" — trades opened in the emotional wake of
 * a loss (quick re-entries and size spikes), with their P&L held against the
 * rest of the book.
 */
export function BehaviorRevengeCard({
  report,
  loading,
  error,
  onSelectTradeId,
}: BehaviorRevengeCardProps) {
  usePrivacyMode();
  const money = useReportsMoney();
  const locale = intlLocale();

  if (loading) {
    return (
      <Card title="Revenge trading">
        <Skeleton height="160px" />
      </Card>
    );
  }
  if (error) {
    return (
      <Card title="Revenge trading">
        <p className="m-0 text-xs text-destructive">Failed to load behavior report.</p>
      </Card>
    );
  }

  const sec = report?.revenge;
  if (!sec || sec.events.length === 0) {
    return (
      <Card title="Revenge trading">
        <EmptyState
          title="No revenge patterns detected"
          hint="Flags trades opened within an hour of a losing close — same-symbol re-entries inside 15 minutes, or entries sized 1.5× above your recent median."
        />
      </Card>
    );
  }

  const recent = sec.events.slice(-6).reverse();

  return (
    <Card
      title="Revenge trading"
      description="Trades opened shortly after a loss, compared against the rest of your book."
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatCard
            label="Flagged trades"
            value={String(sec.flagged.trades)}
            hint={`${sec.events.length} event${sec.events.length === 1 ? "" : "s"}`}
          />
          <StatCard
            label="Flagged P&L"
            value={money.format(sec.flagged.net_pnl)}
            accent={sec.flagged.net_pnl >= 0 ? "pos" : "neg"}
          />
          <StatCard
            label="Flagged win rate"
            value={fmtPct(sec.flagged.win_rate, locale)}
            hint={`baseline ${fmtPct(sec.baseline.win_rate, locale)}`}
          />
          <StatCard
            label="Baseline P&L"
            value={money.format(sec.baseline.net_pnl)}
            accent={sec.baseline.net_pnl >= 0 ? "pos" : "neg"}
            hint={`${sec.baseline.trades} trades`}
          />
        </div>

        {sec.insufficient_data && (
          <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
            Small sample — patterns firm up as more closed trades accumulate.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <p className="m-0 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Recent events
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {recent.map((ev) => (
              <li key={ev.trade_id}>
                <button
                  type="button"
                  onClick={() => onSelectTradeId?.(ev.trade_id)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"
                >
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-foreground">
                      {fmtDayShort(`${ev.date}T12:00:00Z`, locale)}
                    </span>
                    <span className="font-medium text-foreground">{ev.symbol}</span>
                    {ev.reason === "quick_reentry" ? (
                      <Pill tone="amber">re-entry</Pill>
                    ) : (
                      <Pill tone="amber">size ×{(ev.size_ratio ?? 0).toFixed(1)}</Pill>
                    )}
                  </span>
                  <span
                    className={
                      ev.net_pnl >= 0
                        ? "tabular-nums font-medium text-profit"
                        : "tabular-nums font-medium text-destructive"
                    }
                  >
                    {money.format(ev.net_pnl)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
