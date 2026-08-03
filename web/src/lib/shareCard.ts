import type { TradeDetail } from "@/lib/api/types";
import { getDisplayTimeOpts } from "@/lib/displayPrefs";
import { fmtPct, fmtSignedMoney } from "@/lib/format";
import type { TradeInsights } from "@/lib/tradeInsights";
import type { YearWrapped } from "@/lib/wrapped";

export interface ShareCardStat {
  label: string;
  value: string;
}

export type ShareCardTone = "profit" | "loss" | "flat";
export type ShareCardChipTone = ShareCardTone | "muted" | "brand";

export interface ShareCardChip {
  text: string;
  tone: ShareCardChipTone;
}

export interface ShareCardData {
  title: string;
  /** Accessible name for the rendered SVG. */
  ariaLabel: string;
  chips: ShareCardChip[];
  tone: ShareCardTone;
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
    title: trade.symbol,
    ariaLabel: `${trade.symbol} trade card`,
    chips: [
      { text: trade.direction === "short" ? "SHORT" : "LONG", tone: "muted" },
      { text: outcome, tone: outcome === "OPEN" ? "brand" : tone },
    ],
    tone,
    dateLabel,
    hero,
    stats,
  };
}

/**
 * Build the data for a shareable Year Wrapped card. Same privacy stance as
 * the trade card: the default speaks in win rate and ratios — dollars appear
 * only when showAmounts is explicitly on.
 */
export function buildWrappedShareCard(
  wrapped: YearWrapped,
  opts: {
    showAmounts: boolean;
    locale: string;
    currency: string;
    fxRate: number;
    /** True while the year is still running (current year → "Year to date"). */
    inProgress?: boolean;
  },
): ShareCardData {
  const tone: ShareCardTone = wrapped.netPnl > 0 ? "profit" : wrapped.netPnl < 0 ? "loss" : "flat";
  const money = (v: number) => fmtSignedMoney(v * opts.fxRate, opts.currency, opts.locale);
  const winRate = fmtPct(wrapped.winRate, opts.locale);
  const profitFactor = wrapped.profitFactor > 0 ? wrapped.profitFactor.toFixed(2) : "0.00";

  const hero: ShareCardStat = opts.showAmounts
    ? { label: "Net P&L", value: money(wrapped.netPnl) }
    : { label: "Win rate", value: winRate };

  const candidates: (ShareCardStat | null)[] = [
    opts.showAmounts ? { label: "Win rate", value: winRate } : null,
    { label: "Profit factor", value: profitFactor },
    opts.showAmounts && wrapped.bestDay
      ? { label: "Best day", value: money(wrapped.bestDay.pnl) }
      : null,
    !opts.showAmounts
      ? { label: "Green days", value: `${wrapped.greenDays} of ${wrapped.tradingDays}` }
      : null,
    !opts.showAmounts && wrapped.bestStreak > 0
      ? { label: "Best streak", value: `${wrapped.bestStreak} wins` }
      : null,
  ];

  return {
    title: `${wrapped.year} Wrapped`,
    ariaLabel: `${wrapped.year} Wrapped share card`,
    chips: [
      { text: `${wrapped.totalTrades} TRADES`, tone: "muted" },
      {
        text: tone === "profit" ? "GREEN YEAR" : tone === "loss" ? "RED YEAR" : "FLAT YEAR",
        tone,
      },
    ],
    tone,
    dateLabel: opts.inProgress ? "Year to date" : "Full year",
    hero,
    stats: candidates.filter((s): s is ShareCardStat => s != null).slice(0, 3),
  };
}
