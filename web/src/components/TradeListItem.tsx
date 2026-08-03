import { ArrowDownRight, ArrowUpRight, NotebookPen } from "lucide-react";
import type { Trade } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtDuration, fmtMoney, fmtSignedMoney, fmtTradeDay } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { resolveTradeDirection } from "@/lib/tradeDirection";
import { DIR_TONE_CLASS } from "./DirCell";
import { Item, ItemContent, ItemTitle } from "./Item";
import { Pill } from "./Pill";
import { outlineSurfaceClass } from "./surface-styles";
import { pnlColor } from "./theme-tokens";
import { marketLabel, tradeNotional, tradeRMultiple, tradeStatus } from "./tradeColumns";

/** Tags beyond this get rolled into a "+N", as in the table's Tags column. */
const MAX_TAGS = 2;

export interface TradeMetaPart {
  key: string;
  text: string;
  /** Dropped when the row itself gets narrow (~<19rem), not the viewport. */
  optional?: boolean;
}

/**
 * "Jul 22" — or "Jul 22, 2025" off the current year. Reads the calendar date off
 * `fmtTradeDay`'s ISO output so the day matches the table's Date column exactly,
 * then builds a local Date from the parts so nothing shifts across a timezone.
 */
function listDate(iso: string | null): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fmtTradeDay(iso));
  if (!parts) return fmtTradeDay(iso);
  const [, y, m, d] = parts.map(Number) as [unknown, number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(intlLocale(), {
    month: "short",
    day: "numeric",
    year: y === new Date().getFullYear() ? undefined : "numeric",
  });
}

/** Footer line: market, date, hold, R multiple. */
export function tradeListMeta(trade: Trade, showDate = false): TradeMetaPart[] {
  const hold = fmtDuration(trade.time_in_trade_secs);
  const r = tradeRMultiple(trade);
  const parts: TradeMetaPart[] = [{ key: "market", text: marketLabel(trade.instrument_type) }];
  if (showDate) parts.push({ key: "date", text: listDate(trade.opened_at) });
  if (hold !== "-") parts.push({ key: "hold", text: hold, optional: true });
  if (r != null) parts.push({ key: "r", text: `${r.toFixed(2)}R`, optional: true });
  return parts;
}

/** Price line: size at entry, then the exit once there is one. */
export function tradeListPrices(trade: Trade, currency: string, fxRate = 1): string {
  const locale = intlLocale();
  const qty = trade.qty_opened.toFixed(trade.qty_opened % 1 === 0 ? 0 : 2);
  const entry = fmtMoney(trade.avg_entry_price * fxRate, currency, locale);
  if (trade.avg_exit_price == null) return `${qty} @ ${entry}`;
  return `${qty} @ ${entry} → ${fmtMoney(trade.avg_exit_price * fxRate, currency, locale)}`;
}

export interface TradeListItemProps {
  trade: Trade;
  currency: string;
  fxRate?: number;
  /** Row activation — the peek drawer in both current call sites. */
  onSelect: (trade: Trade) => void;
  /** Prefix the meta line with the trade date. Off for single-day lists. */
  showDate?: boolean;
  className?: string;
}

/**
 * One trade as a list row, in three lines: identity and P&L, size and prices,
 * then a quiet footer of market/date/hold/R and tags. Shared by the day drawer
 * and the mobile trade log, where the 19-column table can't fit; tap opens the
 * detail drawer for everything not shown here.
 */
export function TradeListItem({
  trade,
  currency,
  fxRate = 1,
  onSelect,
  showDate = false,
  className,
}: TradeListItemProps) {
  usePrivacyMode();
  const status = tradeStatus(trade);
  const dir = resolveTradeDirection({
    direction: trade.direction,
    instrumentType: trade.instrument_type,
    symbol: trade.symbol,
    // Say "unknown" rather than a bare LONG when this is an option whose
    // call/put can't be read off the symbol — the trades payload carries no
    // option_right, so an OCC-style symbol is the only source in a list row.
    markMissingOptionRight: true,
  });
  const DirIcon = dir.arrowUp ? ArrowUpRight : ArrowDownRight;
  const side = dir.long ? "LONG" : "SHORT";
  const optionRight =
    dir.tag === "LC" || dir.tag === "SC"
      ? "CALL"
      : dir.tag === "LP" || dir.tag === "SP"
        ? "PUT"
        : null;
  const rightUnknown = dir.tag === "?";
  // A missing call/put is an account-wide data gap, not a per-trade alert — an
  // amber flag on every option row is just noise. Stay muted; the "?" and its
  // tooltip carry the message.
  const dirClass = rightUnknown ? "text-muted-foreground" : DIR_TONE_CLASS[dir.tone];
  const shownTags = trade.tags.slice(0, MAX_TAGS);
  const restTags = trade.tags.length - shownTags.length;
  const hasNotes = trade.notes.trim().length > 0;

  return (
    <Item
      variant="outline"
      size="default"
      className={cn(
        // Container, not viewport: the same row serves the 440px day drawer and
        // the phone trade log, and it should adapt to whichever it sits in.
        "@container/trade-row w-full cursor-pointer items-stretch gap-2 rounded-lg px-3.5 py-3",
        // Same border, fill, and bevel as the coss outline Button.
        outlineSurfaceClass,
        "hover:bg-accent/50 focus-visible:bg-accent/50 dark:hover:bg-input/64",
        "active:shadow-none dark:active:bg-input/64",
        className,
      )}
      tabIndex={0}
      onClick={() => onSelect(trade)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(trade);
        }
      }}
    >
      <ItemContent className="gap-1">
        <div className="flex items-start justify-between gap-3">
          {/* Wraps rather than truncates: the symbol is the row's identity, so on
              a cramped row it takes a second line instead of being clipped. */}
          <ItemTitle className="min-w-0 flex-wrap gap-x-1.5 gap-y-1 text-base">
            <span className="mr-0.5 font-semibold tracking-tight text-foreground">
              {trade.symbol}
            </span>
            {/* Direction rides as a tag next to the status one, spelling out side
                and option right ("LONG CALL") rather than the table's terse
                LC/SP. Neutral chip, with tone on the arrow and the call/put word
                — the parts that carry the bias — so green/red elsewhere in the
                row still means outcome. */}
            <Pill className="shrink-0 px-2" tone="muted" title={dir.detail}>
              <DirIcon size={11} strokeWidth={2.75} className={dirClass} aria-hidden />
              {side}
              {optionRight ? <span className={dirClass}>{optionRight}</span> : null}
              {rightUnknown ? (
                <>
                  <span className="opacity-70" aria-hidden>
                    ?
                  </span>
                  <span className="sr-only">{dir.label}</span>
                </>
              ) : null}
            </Pill>
            <Pill
              className="shrink-0"
              tone={status.tone}
              title={status.label === "BE" ? "Break-even" : undefined}
            >
              {status.label}
            </Pill>
          </ItemTitle>
          <span
            className={cn(
              "shrink-0 text-[17px] leading-snug font-semibold tabular-nums whitespace-nowrap",
              "@max-[19rem]/trade-row:text-[14px]",
              trade.net_pnl != null ? pnlColor(trade.net_pnl) : "text-muted-foreground",
            )}
          >
            {trade.net_pnl != null
              ? fmtSignedMoney(trade.net_pnl * fxRate, currency, intlLocale())
              : "—"}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-3 text-[14px] tabular-nums">
          <span className="min-w-0 truncate text-foreground">
            {tradeListPrices(trade, currency, fxRate)}
            {/* Position size, so an option's P&L reconciles: 1 contract moving
                $0.18 is $18, not $0.18, and the ×100 is invisible otherwise. */}
            <span className="text-muted-foreground @max-[19rem]/trade-row:hidden">
              {" · "}
              {fmtMoney(
                tradeNotional(trade.qty_opened, trade.avg_entry_price, trade.instrument_type) *
                  fxRate,
                currency,
                intlLocale(),
              )}
            </span>
          </span>
          {trade.return_pct != null && (
            // Muted, not a second green/red: one colored number per row keeps
            // the P&L the thing the eye lands on.
            <span className="shrink-0 whitespace-nowrap text-muted-foreground">
              {trade.return_pct >= 0 ? "+" : ""}
              {trade.return_pct.toFixed(2)}%
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="m-0 min-w-0 truncate text-[12px] leading-normal text-muted-foreground">
            {tradeListMeta(trade, showDate).map((part, i) => (
              <span
                key={part.key}
                className={part.optional ? "@max-[19rem]/trade-row:hidden" : undefined}
              >
                {i > 0 ? <span aria-hidden> · </span> : null}
                {part.text}
              </span>
            ))}
          </p>
          {(shownTags.length > 0 || hasNotes) && (
            <span className="flex shrink-0 items-center gap-1.5 @max-[19rem]/trade-row:hidden">
              {hasNotes ? (
                <NotebookPen
                  size={13}
                  strokeWidth={1.75}
                  className="text-muted-foreground"
                  aria-label="Has notes"
                />
              ) : null}
              {shownTags.map((t) => (
                <Pill key={t.id} tone={t.kind === "mistake" ? "neg" : "muted"} title={t.name}>
                  {t.name}
                </Pill>
              ))}
              {restTags > 0 ? (
                <span className="text-[12px] text-muted-foreground">+{restTags}</span>
              ) : null}
            </span>
          )}
        </div>
      </ItemContent>
    </Item>
  );
}
