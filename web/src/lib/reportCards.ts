export type ReportsTab = "overview" | "win-loss" | "detailed" | "risk" | "behavior";

export interface ReportCardDef {
  id: string;
  label: string;
}

/**
 * Every card the Reports page can render, per tab, in default order. Paired
 * half-width cards (Symbol & Tag, Day of Week & Hourly) count as one unit so
 * toggling can't strand a lone half-width card in a two-column grid.
 */
export const REPORT_CARDS: Record<ReportsTab, ReportCardDef[]> = {
  overview: [
    { id: "summary", label: "Summary metrics" },
    { id: "period-returns", label: "Period returns" },
    { id: "execution-score", label: "Execution quality score" },
    { id: "playbook", label: "Playbook & Leaks" },
    { id: "r-multiple", label: "R-Multiple performance" },
    { id: "execution-grade", label: "Execution grade" },
  ],
  "win-loss": [
    { id: "rolling-win-rate", label: "Rolling win rate" },
    { id: "metric-evolution", label: "Metric evolution" },
  ],
  detailed: [
    { id: "session-clock", label: "Session clock" },
    { id: "symbol-tag", label: "Symbol & Tag breakdown" },
    { id: "day-hour", label: "Day of week & Hourly" },
    { id: "signed-bars", label: "Win / loss bars" },
    { id: "duration-scatter", label: "Duration scatter" },
    { id: "pnl-heatmap", label: "P&L heatmap" },
    { id: "sessions", label: "Session performance" },
    { id: "symbol-heatmap", label: "Symbol heatmap" },
  ],
  risk: [
    { id: "drawdown", label: "Risk & drawdown" },
    { id: "monte-carlo", label: "Monte Carlo simulation" },
    { id: "rule-compliance", label: "Rule compliance" },
  ],
  behavior: [
    { id: "revenge", label: "Revenge trading" },
    { id: "overconfidence", label: "Overconfidence" },
    { id: "loss-aversion", label: "Loss aversion" },
  ],
};

export const REPORT_TAB_IDS = Object.keys(REPORT_CARDS) as ReportsTab[];

export function defaultCardIds(tab: ReportsTab): string[] {
  return REPORT_CARDS[tab].map((c) => c.id);
}

/**
 * Keep only ids this tab knows (order preserved, duplicates dropped). An
 * empty or malformed list falls back to the defaults — a preset saved by a
 * newer client, or a hand-edited blob, degrades to "show everything" rather
 * than a blank tab.
 */
export function sanitizeCardIds(tab: ReportsTab, ids: unknown): string[] {
  if (!Array.isArray(ids)) return defaultCardIds(tab);
  const known = new Set(defaultCardIds(tab));
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !known.has(id) || out.includes(id)) continue;
    out.push(id);
  }
  return out.length > 0 ? out : defaultCardIds(tab);
}
