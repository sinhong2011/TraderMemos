import type { TradeDetail } from "./api/types";
import { getDisplayTimeOpts } from "./displayPrefs";
import { fmtDateTime, fmtTime } from "./format";
import { intlLocale } from "./locale";

function calendarDayKey(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Compact open→close line for a trade header (identity, not a metric dump).
 * Same-day trades print the date once — `Jul 23, 2026 · 06:51 → 06:55 · 4m` —
 * rather than repeating it on both sides of the arrow.
 */
export function fmtTradeTimeline(
  trade: Pick<TradeDetail, "opened_at" | "closed_at" | "status">,
  hold: string,
): string {
  const opened = new Date(trade.opened_at);
  if (Number.isNaN(opened.getTime())) return "—";

  const { timeZone } = getDisplayTimeOpts();
  const day = opened.toLocaleDateString(intlLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
  const holdPart = hold && hold !== "-" ? ` · ${hold}` : "";

  if (trade.status === "open" || !trade.closed_at) {
    return `${fmtDateTime(trade.opened_at)} · still open`;
  }

  const closed = new Date(trade.closed_at);
  if (Number.isNaN(closed.getTime())) return `${day}${holdPart}`;

  if (calendarDayKey(opened, timeZone) === calendarDayKey(closed, timeZone)) {
    return `${day} · ${fmtTime(trade.opened_at)} → ${fmtTime(trade.closed_at)}${holdPart}`;
  }

  return `${fmtDateTime(trade.opened_at)} → ${fmtDateTime(trade.closed_at)}${holdPart}`;
}
