import { StatBar } from "./StatBar";
import { pnlColor } from "./theme-tokens";
import type { Summary, Trade } from "../lib/api/types";
import { cn } from "../lib/cn";
import { usePrivacyMode } from "../lib/displayPrefs";
import { fmtMoney, fmtPct, fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";
import type { TradeStatusFilter } from "../lib/tradeFilters";

export interface PerformanceStripProps {
  summary: Summary;
  trades: Trade[];
  currency: string;
  /** Multiply money fields by this FX rate (base → display). */
  fxRate?: number;
  tradeStatusFilter?: TradeStatusFilter;
  onToggleTradeStatus?: (filter: TradeStatusFilter) => void;
}

function Meta({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <p className="m-0 flex items-baseline gap-1.5 text-[13px] tabular-nums">
      <span className="font-medium tracking-wide text-text-muted">{label}</span>
      <span className={cn("font-medium", className)}>{value}</span>
    </p>
  );
}

export function PerformanceStrip({
  summary,
  trades,
  currency,
  fxRate = 1,
  tradeStatusFilter,
  onToggleTradeStatus,
}: PerformanceStripProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const total = Math.max(summary.total_trades, 1);
  const allTotal = Math.max(trades.length, 1);
  const openCount = trades.filter((t) => t.status === "open").length;
  const toggle = (f: TradeStatusFilter) => onToggleTradeStatus?.(f);
  const gross = summary.gross_profit + summary.gross_loss;
  const money = (v: number) => v * fxRate;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Net hero */}
      <section className="flex min-h-[133px] flex-1 flex-col rounded-card bg-bg-panel p-5">
        <p className="self-start text-[12px] font-semibold tracking-wide text-signal">
          Performance
        </p>
        <p className="mt-3 self-start text-[12px] font-medium tracking-wide text-text-muted">Net</p>
        <div className="mt-3 flex flex-1 flex-col items-center justify-center text-center">
          <p
            className={cn(
              "text-[32px] font-semibold leading-none tracking-[-0.04em] tabular-nums",
              pnlColor(summary.net_pnl),
              summary.net_pnl > 0 && "drop-shadow-[0_0_28px_rgba(74,222,128,0.28)]",
              summary.net_pnl < 0 && "drop-shadow-[0_0_28px_rgba(251,113,133,0.22)]",
            )}
          >
            {fmtSignedMoney(money(summary.net_pnl), currency, locale)}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
            <Meta
              label="Gross"
              value={fmtSignedMoney(money(gross), currency, locale)}
              className={pnlColor(gross)}
            />
            <Meta label="Fees" value={fmtMoney(money(summary.total_fees), currency, locale)} />
            <Meta
              label="PF"
              value={summary.profit_factor != null ? summary.profit_factor.toFixed(2) : "—"}
            />
            <Meta
              label="Expect"
              value={fmtSignedMoney(money(summary.expectancy), currency, locale)}
              className={pnlColor(summary.expectancy)}
            />
          </div>
        </div>
      </section>

      {/* Outcome filters */}
      <div className="grid min-h-[91px] flex-[0.85] grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        <StatBar
          label="Wins"
          value={String(summary.wins)}
          sub={fmtPct(summary.win_rate, locale)}
          tone="pos"
          active={tradeStatusFilter === "win"}
          onClick={toggle ? () => toggle("win") : undefined}
        />
        <StatBar
          label="Losses"
          value={String(summary.losses)}
          sub={fmtPct(summary.losses / total, locale)}
          tone="neg"
          active={tradeStatusFilter === "loss"}
          onClick={toggle ? () => toggle("loss") : undefined}
        />
        <StatBar
          label="Open"
          value={String(openCount)}
          sub={fmtPct(openCount / allTotal, locale)}
          tone="accent"
          active={tradeStatusFilter === "open"}
          onClick={toggle ? () => toggle("open") : undefined}
        />
        <StatBar
          label="Wash"
          value={String(summary.breakeven)}
          sub={fmtPct(summary.breakeven / total, locale)}
          tone="amber"
          active={tradeStatusFilter === "wash"}
          onClick={toggle ? () => toggle("wash") : undefined}
        />
      </div>

      {/* Avg edge */}
      <div className="grid min-h-[91px] flex-[0.85] grid-cols-2 gap-3">
        <StatBar
          label="Avg win"
          value={fmtMoney(money(summary.avg_win), currency, locale)}
          tone="pos"
        />
        <StatBar
          label="Avg loss"
          value={fmtMoney(money(summary.avg_loss), currency, locale)}
          tone="neg"
        />
      </div>
    </div>
  );
}
