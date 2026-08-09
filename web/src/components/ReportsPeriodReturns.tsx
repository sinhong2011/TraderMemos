import { useState } from "react";
import type { Trade } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useDisplayTimePrefs, usePrivacyMode } from "@/lib/displayPrefs";
import { fmtSignedMoney, fmtSignedPct, fmtTradeDay } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { periodReturns } from "@/lib/reportsAnalytics";
import { useReportsMoney } from "./ReportsDisplayContext";
import { SegmentedControl } from "./SegmentedControl";
import { pnlColor } from "./theme-tokens";

export interface ReportsPeriodReturnsProps {
  trades: Trade[];
  loading: boolean;
  currency: string;
  fxRate: number;
  /** % basis (net deposits); 0 hides the % toggle. */
  denominator: number;
}

/**
 * Daily / Weekly / Monthly / Annualized return strip. Averages are per traded
 * period; Annualized is the run rate of the filtered span. The % ⇄ $ toggle is
 * local to the strip (P&L basis still follows the net/gross control).
 */
export function ReportsPeriodReturns({
  trades,
  loading,
  currency,
  fxRate,
  denominator,
}: ReportsPeriodReturnsProps) {
  usePrivacyMode();
  useDisplayTimePrefs();
  const locale = intlLocale();
  const money = useReportsMoney();
  const pctEnabled = denominator > 0;
  const [unit, setUnit] = useState<"abs" | "pct">("abs");
  const usePct = unit === "pct" && pctEnabled;

  const returns = periodReturns(trades, money.tradePnl, fmtTradeDay);
  if (loading || returns === null) return null;

  const format = (raw: number) =>
    usePct
      ? fmtSignedPct((raw * fxRate) / denominator, locale)
      : fmtSignedMoney(raw * fxRate, currency, locale);

  const cells: { label: string; hint: string; value: number }[] = [
    { label: "Daily", hint: "avg / traded day", value: returns.daily },
    { label: "Weekly", hint: "avg / traded week", value: returns.weekly },
    { label: "Monthly", hint: "avg / traded month", value: returns.monthly },
    { label: "Annualized", hint: "run rate / year", value: returns.annualized },
  ];

  return (
    <section className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wide text-chart-3">Period returns</p>
        {pctEnabled ? (
          <SegmentedControl
            ariaLabel="Period return unit"
            size="xs"
            value={unit}
            onChange={(v) => setUnit(v as "abs" | "pct")}
            options={[
              { value: "abs", label: "$" },
              { value: "pct", label: "%" },
            ]}
          />
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="flex min-w-0 flex-col gap-1 rounded-lg bg-card p-4">
            <p className="text-[11px] font-medium text-muted-foreground">{c.label}</p>
            <p
              className={cn(
                "text-[17px] font-semibold tracking-[-0.02em] tabular-nums",
                pnlColor(c.value),
              )}
            >
              {format(c.value)}
            </p>
            <p className="text-[10px] text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
