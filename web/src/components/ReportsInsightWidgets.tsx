import type { ReactNode } from "react";
import type { Summary } from "../lib/api/types";
import { cn } from "../lib/cn";
import { usePrivacyMode } from "../lib/displayPrefs";
import { fmtMoney, fmtPct } from "../lib/format";
import { intlLocale } from "../lib/locale";
import { DonutRing } from "./charts/DonutRing";
import { GaugeArc } from "./charts/GaugeArc";
import { WinLossRecord } from "./WinLossRecord";

export interface ReportsInsightWidgetsProps {
  summary: Summary;
  currency: string;
  fxRate?: number;
}

function WidgetShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-h-[120px] min-w-0 flex-col rounded-card bg-bg-panel p-3">
      <p className="text-[10px] font-semibold tracking-wide text-text-muted">{title}</p>
      <div className="mt-2 flex min-h-0 flex-1 flex-col justify-center">{children}</div>
    </section>
  );
}

/** Tradervue-inspired visual insights — Signal Terminal styling. */
export function ReportsInsightWidgets({
  summary,
  currency,
  fxRate = 1,
}: ReportsInsightWidgetsProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const money = (v: number) => v * fxRate;
  const avgWin = summary.avg_win;
  const avgLoss = summary.avg_loss;
  const payoff = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
  const pf = summary.profit_factor;
  const pfFraction = pf <= 0 ? 0 : Math.min(1, pf / 3);
  const winLossTotal = avgWin + avgLoss;
  const winBarPct = winLossTotal > 0 ? (avgWin / winLossTotal) * 100 : 0;

  return (
    <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
      <WidgetShell title="Profit factor">
        <GaugeArc value={pfFraction} className="min-h-[96px]">
          <span className="text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-text">
            {pf > 0 ? pf.toFixed(2) : "—"}
          </span>
        </GaugeArc>
        <p className="mt-1 text-center text-[9px] text-text-dim">1.0 = break-even edge</p>
      </WidgetShell>

      <WidgetShell title="Winning vs losing">
        <DonutRing
          className="mx-auto max-w-[112px]"
          segments={[
            { value: summary.wins, color: "var(--color-profit)" },
            { value: summary.losses, color: "var(--color-loss)" },
            { value: summary.breakeven, color: "var(--color-text-muted)" },
          ]}
        >
          <span className="text-[18px] font-semibold leading-none tabular-nums text-text">
            {fmtPct(summary.win_rate, locale)}
          </span>
          <WinLossRecord
            wins={summary.wins}
            losses={summary.losses}
            separator=" / "
            className="mt-1 text-[11px]"
          />
        </DonutRing>
      </WidgetShell>

      <WidgetShell title="Avg win vs avg loss">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold tabular-nums text-profit">
            {fmtMoney(money(avgWin), currency, locale)}
          </span>
          <span className="text-[13px] font-semibold tabular-nums text-loss">
            {fmtMoney(money(avgLoss), currency, locale)}
          </span>
        </div>
        <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-bg-inset">
          {winLossTotal > 0 ? (
            <>
              <div className="bg-profit" style={{ width: `${winBarPct}%` }} />
              <div className="bg-loss" style={{ width: `${100 - winBarPct}%` }} />
            </>
          ) : null}
        </div>
        <div className="mt-1.5 flex items-baseline justify-between text-[9px] text-text-muted">
          <span>Avg win</span>
          <span>Avg loss</span>
        </div>
      </WidgetShell>

      <WidgetShell title="Payoff ratio">
        <p
          className={cn(
            "text-center text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums",
            payoff >= 1 ? "text-profit" : payoff > 0 ? "text-loss" : "text-text-muted",
          )}
        >
          {payoff === Infinity ? "∞" : payoff > 0 ? `${payoff.toFixed(2)}×` : "—"}
        </p>
        <p className="mt-2 text-center text-[9px] text-text-dim">avg win ÷ avg loss</p>
      </WidgetShell>
    </div>
  );
}
