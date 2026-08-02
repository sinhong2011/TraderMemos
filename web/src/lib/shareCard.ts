import type { TradeDetail } from "@/lib/api/types";
import { getDisplayTimeOpts } from "@/lib/displayPrefs";
import { fmtSignedMoney } from "@/lib/format";
import type { TradeInsights } from "@/lib/tradeInsights";

export interface ShareCardStat {
  label: string;
  value: string;
}

export interface ShareCardData {
  symbol: string;
  directionLabel: "LONG" | "SHORT";
  outcome: "WIN" | "LOSS" | "FLAT" | "OPEN";
  tone: "profit" | "loss" | "flat";
  dateLabel: string;
  hero: ShareCardStat;
  stats: ShareCardStat[];
}

function signedPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function signedR(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`;
}

/**
 * Build the data for a shareable trade card. Privacy-first: dollar amounts
 * appear only when showAmounts is explicitly on — the default card speaks in
 * R multiples and percentages, which brag without disclosing account size.
 */
export function buildTradeShareCard(
  trade: TradeDetail,
  insights: TradeInsights,
  opts: { showAmounts: boolean; locale: string },
): ShareCardData {
  const net = trade.net_pnl ?? 0;
  const closed = trade.status === "closed";
  const outcome = !closed ? "OPEN" : net > 0 ? "WIN" : net < 0 ? "LOSS" : "FLAT";
  const tone = closed && net > 0 ? "profit" : closed && net < 0 ? "loss" : "flat";

  const when = trade.closed_at ?? trade.opened_at;
  // Same display timezone as the rest of the app, so the card date matches
  // the trade header rather than the viewer's OS clock.
  const { timeZone } = getDisplayTimeOpts();
  const dateLabel = new Date(when).toLocaleDateString(opts.locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });

  const r = insights.rMultiple;
  const pct = insights.returnPct;

  let hero: ShareCardStat;
  if (opts.showAmounts) {
    hero = { label: "Net P&L", value: fmtSignedMoney(net, trade.pnl_currency, opts.locale) };
  } else if (r != null) {
    hero = { label: "R multiple", value: signedR(r) };
  } else if (pct != null) {
    hero = { label: "Return", value: signedPct(pct) };
  } else {
    hero = { label: "Status", value: outcome === "OPEN" ? "Open" : outcome.toLowerCase() };
  }

  const candidates: (ShareCardStat | null)[] = [
    opts.showAmounts && r != null ? { label: "R multiple", value: signedR(r) } : null,
    pct != null && hero.label !== "Return" ? { label: "Return", value: signedPct(pct) } : null,
    insights.holdLabel ? { label: "Hold", value: insights.holdLabel } : null,
    insights.setupName ? { label: "Setup", value: insights.setupName } : null,
  ];
  const stats = candidates.filter((s): s is ShareCardStat => s != null).slice(0, 3);

  return {
    symbol: trade.symbol,
    directionLabel: trade.direction === "short" ? "SHORT" : "LONG",
    outcome,
    tone,
    dateLabel,
    hero,
    stats,
  };
}
