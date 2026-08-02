import type { BehaviorReport } from "@/lib/api/types";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtDayShort, fmtDuration } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Pill } from "./Pill";
import { useReportsMoney } from "./ReportsDisplayContext";
import { Skeleton } from "./Skeleton";
import { StatCard } from "./StatCard";

export interface BehaviorLossAversionCardProps {
  report?: BehaviorReport;
  loading: boolean;
  error: boolean;
  onSelectTradeId?: (id: string) => void;
}

/**
 * "Do I hold losers and cut winners?" — hold-time asymmetry plus the losers
 * that were green at their peak (MFE) before being given back to the market.
 */
export function BehaviorLossAversionCard({
  report,
  loading,
  error,
  onSelectTradeId,
}: BehaviorLossAversionCardProps) {
  usePrivacyMode();
  const money = useReportsMoney();
  const locale = intlLocale();

  if (loading) {
    return (
      <Card title="Loss aversion">
        <Skeleton height="160px" />
      </Card>
    );
  }
  if (error) {
    return (
      <Card title="Loss aversion">
        <p className="m-0 text-xs text-destructive">Failed to load behavior report.</p>
      </Card>
    );
  }

  const sec = report?.loss_aversion;
  const hasHolds = sec && (sec.avg_win_hold_secs > 0 || sec.avg_loss_hold_secs > 0);
  if (!sec || (!hasHolds && sec.give_back_count === 0)) {
    return (
      <Card title="Loss aversion">
        <EmptyState
          title="Not enough closed trades yet"
          hint="Compares how long winners and losers are held, and finds losing trades that were profitable at their peak."
        />
      </Card>
    );
  }

  return (
    <Card
      title="Loss aversion"
      description="Hold-time asymmetry and losers that were green at their peak before turning red."
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatCard
            label="Avg winner hold"
            value={fmtDuration(sec.avg_win_hold_secs)}
            hint={`median ${fmtDuration(sec.median_win_hold_secs)}`}
          />
          <StatCard
            label="Avg loser hold"
            value={fmtDuration(sec.avg_loss_hold_secs)}
            hint={`median ${fmtDuration(sec.median_loss_hold_secs)}`}
            accent={sec.hold_ratio > 1.5 ? "neg" : "none"}
          />
          <StatCard
            label="Hold ratio"
            value={sec.hold_ratio > 0 ? `${sec.hold_ratio.toFixed(1)}×` : "—"}
            hint="losers vs winners"
            accent={sec.hold_ratio > 1.5 ? "neg" : "none"}
          />
          <StatCard
            label="Profit given back"
            value={money.format(sec.missed_profit)}
            hint={`${sec.give_back_count} trade${sec.give_back_count === 1 ? " was" : "s were"} green at peak`}
            accent={sec.missed_profit > 0 ? "neg" : "none"}
          />
        </div>

        {sec.excluded > 0 && (
          <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
            {sec.excluded} loser{sec.excluded === 1 ? "" : "s"} without recorded MAE/MFE could not
            be checked — use the auto-compute button on a trade to fill excursion data.
          </p>
        )}

        {sec.give_backs.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="m-0 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              Biggest give-backs
            </p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {sec.give_backs.map((gb) => (
                <li key={gb.trade_id}>
                  <button
                    type="button"
                    onClick={() => onSelectTradeId?.(gb.trade_id)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"
                  >
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-foreground">
                        {fmtDayShort(`${gb.date}T12:00:00Z`, locale)}
                      </span>
                      <span className="font-medium text-foreground">{gb.symbol}</span>
                      <Pill tone="amber">peak {money.format(gb.mfe)}</Pill>
                    </span>
                    <span className="tabular-nums font-medium text-destructive">
                      {money.format(gb.net_pnl)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
