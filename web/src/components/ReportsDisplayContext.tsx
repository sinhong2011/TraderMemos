import { createContext, useContext, type ReactNode } from "react";
import type { Summary, Trade } from "@/lib/api/types";
import { fmtPct, fmtSignedMoney, fmtSignedMoneyCompact } from "@/lib/format";
import { intlLocale } from "@/lib/locale";

export type PnlMode = "net" | "gross";
export type UnitMode = "abs" | "pct";
export type AvgMode = "mean" | "median";

export interface ReportsDisplay {
  pnlMode: PnlMode;
  unitMode: UnitMode;
  /** Mean vs outlier-resistant median for per-trade stats; defaults to mean. */
  avgMode?: AvgMode;
  denominator: number; // % basis (starting balance); 0 disables %
  currency: string;
  fxRate: number;
}

const DEFAULT: ReportsDisplay = {
  pnlMode: "net",
  unitMode: "abs",
  avgMode: "mean",
  denominator: 0,
  currency: "USD",
  fxRate: 1,
};

const Ctx = createContext<ReportsDisplay>(DEFAULT);

export function ReportsDisplayProvider({
  value,
  children,
}: {
  value: ReportsDisplay;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReportsMoney() {
  const d = useContext(Ctx);
  const locale = intlLocale();
  const pctEnabled = d.denominator > 0;
  const usePct = d.unitMode === "pct" && pctEnabled;

  // Gross = before fees. Do NOT use gross_profit - gross_loss here: those are
  // net-classified win/loss sums, so their difference is identically net_pnl
  // and the toggle would be a no-op. Fall back to net + fees for older APIs.
  const pnl = (s: Summary) =>
    d.pnlMode === "gross" ? (s.gross_pnl ?? s.net_pnl + s.total_fees) : s.net_pnl;
  const tradePnl = (t: Trade) =>
    d.pnlMode === "gross" ? (t.gross_pnl ?? t.net_pnl ?? 0) : (t.net_pnl ?? 0);

  const display = (rawPnl: number) =>
    usePct ? (rawPnl * d.fxRate) / d.denominator : rawPnl * d.fxRate;
  const format = (rawPnl: number) =>
    usePct
      ? fmtPct((rawPnl * d.fxRate) / d.denominator, locale)
      : fmtSignedMoney(rawPnl * d.fxRate, d.currency, locale);
  const formatCompact = (rawPnl: number) =>
    usePct
      ? fmtPct((rawPnl * d.fxRate) / d.denominator, locale)
      : fmtSignedMoneyCompact(rawPnl * d.fxRate, d.currency, locale);
  const formatAxis = (displayValue: number) =>
    usePct ? fmtPct(displayValue, locale) : fmtSignedMoneyCompact(displayValue, d.currency, locale);

  return {
    pnlMode: d.pnlMode,
    avgMode: d.avgMode ?? "mean",
    unitMode: usePct ? "pct" : "abs",
    pctEnabled,
    pnl,
    tradePnl,
    display,
    format,
    formatCompact,
    formatAxis,
  };
}
