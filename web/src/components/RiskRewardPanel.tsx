import type { TradeDetail } from "../lib/api/types";
import { fmtMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";
import { computeRiskReward, type RiskRewardMetrics } from "../lib/riskReward";
import { cn } from "../lib/cn";
import { pnlColor } from "./theme-tokens";
import { usePrivacyMode } from "../lib/displayPrefs";

const sectionLabelClass = "mb-3 text-[10px] font-semibold uppercase tracking-widest text-chart-3";

function StatCell({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-sm tabular-nums text-foreground", valueClassName)}>{value}</span>
    </div>
  );
}

function formatMoneyOrDash(v: number | null, currency: string): string {
  if (v == null) return "-";
  return fmtMoney(v, currency, intlLocale());
}

export interface RiskRewardPanelProps {
  trade: TradeDetail;
  metrics?: RiskRewardMetrics;
  className?: string;
  /** When true, omit the panel entirely if every metric is empty. */
  hideWhenEmpty?: boolean;
}

export function RiskRewardPanel({
  trade,
  metrics,
  className,
  hideWhenEmpty = false,
}: RiskRewardPanelProps) {
  usePrivacyMode();
  const m = metrics ?? computeRiskReward(trade);
  const currency = trade.pnl_currency;

  const maxProfitValue =
    m.maxProfit != null ? formatMoneyOrDash(m.maxProfit, currency) : m.target != null ? "∞" : null;

  const cells: { label: string; value: string; valueClassName?: string }[] = [];

  if (m.target != null) {
    cells.push({ label: "Target", value: fmtMoney(m.target, currency, intlLocale()) });
  }
  if (m.stop != null) {
    cells.push({ label: "Stop", value: fmtMoney(m.stop, currency, intlLocale()) });
  }
  if (maxProfitValue != null) {
    cells.push({
      label: "Max profit",
      value: maxProfitValue,
      valueClassName: m.maxProfit != null ? pnlColor(m.maxProfit) : undefined,
    });
  }
  if (m.maxLoss != null) {
    cells.push({
      label: "Max loss",
      value: formatMoneyOrDash(m.maxLoss, currency),
      valueClassName: pnlColor(m.maxLoss),
    });
  }
  if (m.breakeven != null) {
    cells.push({
      label: "Breakeven",
      value: fmtMoney(m.breakeven, currency, intlLocale()),
    });
  }
  if (m.plannedRR != null) {
    cells.push({ label: "Planned R:R", value: `${m.plannedRR.toFixed(2)}:1` });
  }
  if (trade.r_multiple != null) {
    cells.push({
      label: "R-multiple",
      value: `${trade.r_multiple >= 0 ? "+" : ""}${trade.r_multiple.toFixed(2)}R`,
      valueClassName: pnlColor(trade.r_multiple),
    });
  }

  if (cells.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <section className={cn("px-4 py-3", className)}>
        <p className={sectionLabelClass}>Risk / Reward</p>
        <p className="text-xs text-muted-foreground">
          No plan set — add target and stop on the full page.
        </p>
      </section>
    );
  }

  return (
    <section className={cn("px-4 py-3", className)}>
      <p className={sectionLabelClass}>Risk / Reward</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {cells.map((cell) => (
          <StatCell
            key={cell.label}
            label={cell.label}
            value={cell.value}
            valueClassName={cell.valueClassName}
          />
        ))}
      </div>
    </section>
  );
}
