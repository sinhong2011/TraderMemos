import { Card } from "./Card";
import { cardSectionLabelClass, StatCell } from "./StatCell";
import { pnlColor } from "./theme-tokens";
import { TradeExcursionChart } from "./TradeExcursionChart";
import { Button } from "./ui/button";
import type { TradeDetail } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtMoney, fmtSignedMoney } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import type { TradeInsights } from "@/lib/tradeInsights";

/** Bar row: planned risk, planned reward, and what actually landed. */
function PlanBar({
  label,
  amount,
  scale,
  currency,
  tone,
  note,
}: {
  label: string;
  amount: number;
  scale: number;
  currency: string;
  tone: "risk" | "reward" | "result";
  note?: string;
}) {
  const width = scale > 0 ? Math.min(100, (Math.abs(amount) / scale) * 100) : 0;
  const fill =
    tone === "risk"
      ? "bg-destructive/50"
      : tone === "reward"
        ? "bg-profit/50"
        : amount >= 0
          ? "bg-profit"
          : "bg-destructive";

  return (
    <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[5.5rem_1fr_auto]">
      <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        {label}
      </span>
      <span className="h-2 min-w-0 overflow-hidden rounded-full bg-muted/60">
        <span
          className={cn("block h-full rounded-full transition-[width] duration-300", fill)}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="flex items-baseline gap-2 justify-self-end text-right">
        <span
          className={cn(
            "text-[13px] font-semibold tabular-nums",
            tone === "result" ? pnlColor(amount) : "text-foreground",
          )}
        >
          {fmtSignedMoney(amount, currency, intlLocale())}
        </span>
        {note ? (
          <span className="w-[4.5rem] text-[11px] tabular-nums text-muted-foreground">{note}</span>
        ) : (
          <span className="w-[4.5rem]" aria-hidden />
        )}
      </span>
    </div>
  );
}

export interface TradePlanCardProps {
  trade: TradeDetail;
  insights: TradeInsights;
  /** Opens the edit drawer — the only place plan values can be set. */
  onEdit?: () => void;
  /** Computes MAE/MFE from market bars; offered only for closed, chartable trades. */
  onAutoExcursion?: () => void;
  autoExcursionPending?: boolean;
}

/**
 * "Did I follow the plan?" — the review question the old Plan tile could not
 * answer, because it listed risk / target / stop / breakeven as six independent
 * numbers (and six em-dashes when nothing was planned).
 *
 * Here the planned risk, the planned reward, and the realized result are drawn
 * on one shared dollar scale, so under- and over-shooting the plan is visible
 * without arithmetic. Excursion sits alongside rather than buried in Coach:
 * MAE/MFE describe how the trade was managed, not what to do next time.
 */
export function TradePlanCard({
  trade,
  insights,
  onEdit,
  onAutoExcursion,
  autoExcursionPending = false,
}: TradePlanCardProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const currency = trade.pnl_currency;

  const risk =
    insights.maxLoss != null
      ? insights.maxLoss
      : insights.initialRisk != null && insights.initialRisk > 0
        ? -insights.initialRisk
        : null;
  const reward = insights.maxProfit;
  const result = insights.netPnl;
  const hasExcursion = insights.mae != null || insights.mfe != null;
  const hasPlan =
    risk != null || reward != null || insights.stop != null || insights.target != null;

  if (!hasPlan && !hasExcursion) {
    return (
      <Card
        title="Plan vs actual"
        action={
          onEdit ? (
            <Button type="button" variant="soft" size="sm" onClick={onEdit}>
              Add plan
            </Button>
          ) : undefined
        }
      >
        <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
          No plan recorded. Add a stop, target, or risk amount to score this trade in R.
        </p>
        {onAutoExcursion && (
          <Button
            type="button"
            variant="link"
            onClick={onAutoExcursion}
            disabled={autoExcursionPending}
            className="mt-2 h-auto self-start p-0 text-xs"
          >
            {autoExcursionPending ? "Computing…" : "Auto-fill MAE/MFE from market data"}
          </Button>
        )}
      </Card>
    );
  }

  const scale = Math.max(
    Math.abs(risk ?? 0),
    Math.abs(reward ?? 0),
    Math.abs(result ?? 0),
    Number.EPSILON,
  );

  return (
    <Card
      title="Plan vs actual"
      action={
        onEdit ? (
          <Button type="button" variant="link" onClick={onEdit} className="h-auto text-xs">
            Edit plan
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        {hasPlan ? (
          <>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <StatCell label="Stop">
                {insights.stop != null ? fmtMoney(insights.stop, currency, locale) : "—"}
              </StatCell>
              <StatCell label="Target">
                {insights.target != null ? fmtMoney(insights.target, currency, locale) : "—"}
              </StatCell>
              <StatCell label="Breakeven" hint="after fees">
                {insights.breakeven != null ? fmtMoney(insights.breakeven, currency, locale) : "—"}
              </StatCell>
              <StatCell label="Planned R:R">
                {insights.plannedRR != null ? `${insights.plannedRR.toFixed(2)}:1` : "—"}
              </StatCell>
            </div>

            {/* Capped so the amounts stay next to the bars they describe — on a
                wide card an uncapped track pushes them a screen apart. */}
            <div className="flex max-w-2xl flex-col gap-2.5">
              {risk != null && (
                <PlanBar
                  label="Risk"
                  amount={risk}
                  scale={scale}
                  currency={currency}
                  tone="risk"
                  note="planned"
                />
              )}
              {reward != null && (
                <PlanBar
                  label="Reward"
                  amount={reward}
                  scale={scale}
                  currency={currency}
                  tone="reward"
                  note={
                    insights.plannedRR != null ? `${insights.plannedRR.toFixed(1)}R` : "planned"
                  }
                />
              )}
              {result != null && (
                <PlanBar
                  label="Result"
                  amount={result}
                  scale={scale}
                  currency={currency}
                  tone="result"
                  note={
                    insights.rMultiple != null
                      ? `${insights.rMultiple >= 0 ? "+" : ""}${insights.rMultiple.toFixed(2)}R`
                      : undefined
                  }
                />
              )}
            </div>
          </>
        ) : null}

        {(hasExcursion || onAutoExcursion) && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className={cardSectionLabelClass}>Excursion</p>
              {onAutoExcursion && (
                <Button
                  type="button"
                  variant="link"
                  onClick={onAutoExcursion}
                  disabled={autoExcursionPending}
                  className="h-auto text-xs"
                >
                  {autoExcursionPending
                    ? "Computing…"
                    : hasExcursion
                      ? "Recompute from bars"
                      : "Auto-fill from bars"}
                </Button>
              )}
            </div>
            <TradeExcursionChart trade={trade} />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <StatCell
                label="MAE"
                valueClassName={
                  insights.mae != null ? pnlColor(-Math.abs(insights.mae)) : undefined
                }
              >
                {insights.mae != null ? fmtSignedMoney(insights.mae, currency, locale) : "—"}
              </StatCell>
              <StatCell
                label="MFE"
                valueClassName={insights.mfe != null ? pnlColor(Math.abs(insights.mfe)) : undefined}
              >
                {insights.mfe != null ? fmtSignedMoney(insights.mfe, currency, locale) : "—"}
              </StatCell>
              <StatCell
                label="Capture"
                hint="of MFE"
                valueClassName={
                  insights.mfeCapturePct != null ? pnlColor(insights.mfeCapturePct) : undefined
                }
              >
                {insights.mfeCapturePct != null
                  ? `${(insights.mfeCapturePct * 100).toFixed(0)}%`
                  : "—"}
              </StatCell>
              <StatCell label="Left on table">
                {insights.leftOnTable != null
                  ? fmtSignedMoney(insights.leftOnTable, currency, locale)
                  : "—"}
              </StatCell>
              {insights.postExitMfe != null && (
                <StatCell
                  label="Post-exit MFE"
                  hint="run after exit"
                  valueClassName={pnlColor(Math.abs(insights.postExitMfe))}
                >
                  {fmtSignedMoney(insights.postExitMfe, currency, locale)}
                </StatCell>
              )}
              {insights.postExitMae != null && (
                <StatCell
                  label="Post-exit MAE"
                  hint="dip after exit"
                  valueClassName={pnlColor(-Math.abs(insights.postExitMae))}
                >
                  {fmtSignedMoney(insights.postExitMae, currency, locale)}
                </StatCell>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
