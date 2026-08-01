import type { ReactNode } from "react";
import type { EquityCurve, Summary, Trade } from "@/lib/api/types";
import { pnlColor } from "./theme-tokens";
import { cn } from "@/lib/cn";
import { computeHomeInsights } from "@/lib/homeInsights";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtDuration, fmtPct } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { DonutRing } from "./charts/DonutRing";
import { GaugeArc } from "./charts/GaugeArc";
import { useReportsMoney } from "./ReportsDisplayContext";
import { WinLossRecord } from "./WinLossRecord";

export interface ReportsSummaryBentoProps {
  summary: Summary;
  trades: Trade[];
  /** Kept for call-site compatibility; display currency/fx come from ReportsDisplayContext. */
  currency?: string;
  fxRate?: number;
  equity?: EquityCurve;
}

function BentoCell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn("flex h-full min-w-0 flex-col rounded-lg bg-card p-4 sm:p-5", className)}
    >
      {children}
    </section>
  );
}

function Eyebrow({
  children,
  tone = "signal",
}: {
  children: ReactNode;
  tone?: "signal" | "muted";
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold tracking-[0.06em] uppercase sm:text-[12px]",
        tone === "signal"
          ? "text-chart-3"
          : "font-medium normal-case tracking-wide text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

function MetaRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <p className="flex items-baseline justify-between gap-3 text-[13px] tabular-nums">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold", className)}>{value}</span>
    </p>
  );
}

function ContextItem({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "pos" | "neg" | "muted";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-[17px] font-semibold leading-none tracking-[-0.02em] tabular-nums",
          tone === "pos" && "text-profit",
          tone === "neg" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
          !tone && "text-foreground",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 truncate text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Unified performance overview — hero, edge charts, key stats, context strip. */
export function ReportsSummaryBento({ summary, trades, equity }: ReportsSummaryBentoProps) {
  usePrivacyMode();
  const money = useReportsMoney();
  const locale = intlLocale();
  const insights = computeHomeInsights(trades);
  const grossVolume = summary.gross_profit + summary.gross_loss;
  const feePct = grossVolume !== 0 ? (summary.total_fees / Math.abs(grossVolume)) * 100 : 0;
  const openTrades = trades.filter((t) => t.status === "open").length;
  const maxDrawdown = equity?.max_drawdown;
  const heroPnl = money.pnl(summary);

  const avgWin = summary.avg_win;
  const avgLoss = summary.avg_loss;
  const payoff = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
  const pf = summary.profit_factor;
  const pfFraction = pf <= 0 ? 0 : Math.min(1, pf / 3);
  const winLossTotal = avgWin + avgLoss;
  const winBarPct = winLossTotal > 0 ? (avgWin / winLossTotal) * 100 : 0;
  const pfTone = pf >= 1 ? "text-profit" : pf > 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="flex flex-col gap-3">
      {/* Band 1 — hero outcome + edge visuals */}
      <div className="grid gap-3 lg:grid-cols-12">
        <BentoCell className="justify-between lg:col-span-5">
          <div>
            <Eyebrow>Performance</Eyebrow>
            <p className="mt-2 text-[12px] text-muted-foreground">Net P&L</p>
            <p
              className={cn(
                "mt-3 text-center text-[36px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[40px]",
                pnlColor(heroPnl),
                heroPnl > 0 && "drop-shadow-[0_0_32px_rgba(74,222,128,0.3)]",
                heroPnl < 0 && "drop-shadow-[0_0_32px_rgba(251,113,133,0.24)]",
              )}
            >
              {money.format(heroPnl)}
            </p>
          </div>
          <div className="mt-6 space-y-2.5">
            <MetaRow
              label="Gross"
              value={money.format(grossVolume)}
              className={pnlColor(grossVolume)}
            />
            <MetaRow
              label="Fees"
              value={`${money.format(summary.total_fees)} (${feePct.toFixed(1)}%)`}
              className="text-destructive"
            />
            <MetaRow label="Trades" value={String(summary.total_trades)} />
            <MetaRow
              label="Expectancy"
              value={money.format(summary.expectancy)}
              className={pnlColor(summary.expectancy)}
            />
          </div>
        </BentoCell>

        <BentoCell className="lg:col-span-7">
          <Eyebrow>Edge metrics</Eyebrow>
          <div className="mt-3 grid flex-1 grid-cols-2 gap-4 sm:gap-5">
            <div className="flex flex-col items-center justify-center">
              <p className="mb-2 self-start text-[11px] text-muted-foreground">Profit factor</p>
              <GaugeArc
                value={pfFraction}
                className="w-full max-w-[148px]"
                gradientId="reports-pf-gauge"
              >
                <span
                  className={cn(
                    "text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[24px]",
                    pfTone,
                  )}
                >
                  {pf > 0 ? pf.toFixed(2) : "—"}
                </span>
              </GaugeArc>
              <p className="mt-1 text-[10px] text-muted-foreground">1.0 = break-even</p>
            </div>

            <div className="flex flex-col items-center justify-center">
              <p className="mb-2 self-start text-[11px] text-muted-foreground">Win rate</p>
              <DonutRing
                className="w-full max-w-[120px]"
                segments={[
                  { value: summary.wins, color: "var(--profit)" },
                  { value: summary.losses, color: "var(--loss)" },
                  { value: summary.breakeven, color: "var(--muted-foreground)" },
                ]}
              >
                <span className="text-[18px] font-semibold leading-none tabular-nums text-foreground sm:text-[20px]">
                  {fmtPct(summary.win_rate, locale)}
                </span>
                <WinLossRecord
                  wins={summary.wins}
                  losses={summary.losses}
                  separator=" / "
                  className="mt-1 text-[11px]"
                />
              </DonutRing>
            </div>

            <div className="flex flex-col justify-center">
              <p className="text-[11px] text-muted-foreground">Payoff ratio</p>
              <p
                className={cn(
                  "mt-2 text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[30px]",
                  payoff >= 1
                    ? "text-profit"
                    : payoff > 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                )}
              >
                {payoff === Infinity ? "∞" : payoff > 0 ? `${payoff.toFixed(2)}×` : "—"}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">avg win ÷ avg loss</p>
            </div>

            <div className="flex flex-col justify-center">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">Avg win</p>
                  <p className="mt-0.5 truncate text-[14px] font-semibold tabular-nums text-profit">
                    {money.format(avgWin)}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[10px] text-muted-foreground">Avg loss</p>
                  <p className="mt-0.5 truncate text-[14px] font-semibold tabular-nums text-destructive">
                    {money.format(avgLoss)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted">
                {winLossTotal > 0 ? (
                  <>
                    <div className="bg-profit" style={{ width: `${winBarPct}%` }} />
                    <div className="bg-loss" style={{ width: `${100 - winBarPct}%` }} />
                  </>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground">Largest win</p>
                  <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-profit">
                    {money.format(summary.largest_win)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Largest loss</p>
                  <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-destructive">
                    {money.format(summary.largest_loss)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </BentoCell>
      </div>

      {/* Band 2 — four key secondary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BentoCell>
          <Eyebrow tone="muted">Avg trade</Eyebrow>
          <p
            className={cn(
              "mt-3 text-center text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[26px]",
              pnlColor(summary.avg_trade),
            )}
          >
            {money.format(summary.avg_trade)}
          </p>
        </BentoCell>

        <BentoCell>
          <Eyebrow tone="muted">Max drawdown</Eyebrow>
          <p className="mt-3 text-center text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-destructive sm:text-[26px]">
            {maxDrawdown != null && maxDrawdown > 0 ? money.format(-maxDrawdown) : "—"}
          </p>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">peak pullback</p>
        </BentoCell>

        <BentoCell>
          <Eyebrow tone="muted">Total fees</Eyebrow>
          <p className="mt-3 text-center text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-destructive sm:text-[26px]">
            {money.format(summary.total_fees)}
          </p>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            {feePct.toFixed(1)}% of gross
          </p>
        </BentoCell>

        <BentoCell>
          <Eyebrow tone="muted">Open / breakeven</Eyebrow>
          <p className="mt-3 text-center text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground sm:text-[26px]">
            {openTrades} / {summary.breakeven}
          </p>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">active · flat exits</p>
        </BentoCell>
      </div>

      {/* Band 3 — session context in one panel */}
      <BentoCell>
        <Eyebrow>Session context</Eyebrow>
        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          <ContextItem
            label="Best streak"
            value={insights.bestStreak > 0 ? String(insights.bestStreak) : "—"}
            hint={insights.bestStreak > 0 ? "wins in a row" : undefined}
            tone="pos"
          />
          <ContextItem
            label="Worst streak"
            value={insights.worstStreak > 0 ? String(insights.worstStreak) : "—"}
            hint={insights.worstStreak > 0 ? "losses in a row" : undefined}
            tone={insights.worstStreak > 0 ? "neg" : undefined}
          />
          <ContextItem
            label="Best day"
            value={insights.bestDay ? money.format(insights.bestDay.pnl) : "—"}
            hint={insights.bestDay?.date}
            tone={insights.bestDay && insights.bestDay.pnl > 0 ? "pos" : undefined}
          />
          <ContextItem
            label="Worst day"
            value={insights.worstDay ? money.format(insights.worstDay.pnl) : "—"}
            hint={insights.worstDay?.date}
            tone={insights.worstDay && insights.worstDay.pnl < 0 ? "neg" : undefined}
          />
          <ContextItem label="Winning hold" value={fmtDuration(insights.winHoldSecs)} tone="pos" />
          <ContextItem label="Losing hold" value={fmtDuration(insights.lossHoldSecs)} tone="neg" />
          <ContextItem
            label="Avg hold"
            value={fmtDuration(insights.avgHoldSecs)}
            hint={`${summary.total_trades} trades`}
          />
          <ContextItem
            label="Top symbol"
            value={insights.topSymbol ?? "—"}
            hint={insights.topSymbol ? "most traded" : undefined}
          />
          <ContextItem
            label="Main leak"
            value={insights.mainMistake ?? "None tagged"}
            tone={insights.mainMistake ? "neg" : "muted"}
          />
        </div>
      </BentoCell>
    </div>
  );
}
