import type { DayDetail, DayRecord } from "@/lib/calendar";
import type { Trade } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtMoney, fmtPct, fmtSignedMoney, fmtSignedPct } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { resolveTradeDirection } from "@/lib/tradeDirection";
import { marketLabel } from "./tradeColumns";
import { pnlColor } from "./theme-tokens";
import { Button } from "./ui/button";
import { WinLossRecord } from "./WinLossRecord";

function dayTradeCount(rec: DayRecord | undefined): number {
  if (!rec) return 0;
  return rec.wins + rec.losses;
}

function dayWinRate(rec: DayRecord | undefined): string | null {
  if (!rec) return null;
  const n = rec.wins + rec.losses;
  if (n === 0) return null;
  return `${((rec.wins / n) * 100).toFixed(1)}%`;
}

function formatDayTitle(isoDate: string, locale: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function tradeTimeLabel(trade: Trade): string {
  const iso = trade.closed_at ?? trade.opened_at;
  return new Date(iso).toLocaleTimeString(intlLocale(), {
    hour: "numeric",
    minute: "2-digit",
  });
}

function sortedDayTrades(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    const aAt = a.closed_at ?? a.opened_at;
    const bAt = b.closed_at ?? b.opened_at;
    return aAt.localeCompare(bAt);
  });
}

export function CalendarDayHoverDetails({
  date,
  pnl,
  record,
  currency,
  fxRate = 1,
  trades = [],
  detail,
  onOpenDayReview,
}: {
  date: string;
  pnl: number | null;
  record?: DayRecord;
  currency: string;
  fxRate?: number;
  /** Closed trades attributed to this day (shown as compact execution rows). */
  trades?: Trade[];
  /** At-a-glance stats: %, balances, deposits, fees, PF, expectancy. */
  detail?: DayDetail;
  onOpenDayReview?: (day: string) => void;
}) {
  usePrivacyMode();
  const locale = intlLocale();
  const tradeCount = dayTradeCount(record);
  const winRate = dayWinRate(record);
  const hasPnl = pnl != null;
  const rows = sortedDayTrades(trades);

  return (
    <div className="flex min-w-[14rem] flex-col gap-2.5">
      <p className="text-[13px] font-medium text-muted-foreground">
        {formatDayTitle(date, locale)}
      </p>
      {hasPnl ? (
        <>
          <p className={cn("text-[18px] font-semibold tabular-nums", pnlColor(pnl))}>
            {fmtSignedMoney(pnl * fxRate, currency, locale)}
            {detail?.pct != null ? (
              <span className="ml-1.5 text-[13px] opacity-80">
                {fmtSignedPct(detail.pct, locale)}
              </span>
            ) : null}
          </p>
          <div className="flex flex-col gap-0.5 text-[13px] tabular-nums text-muted-foreground">
            <span>
              {tradeCount > 0
                ? `${tradeCount} ${tradeCount === 1 ? "trade" : "trades"}`
                : rows.length > 0
                  ? `${rows.length} ${rows.length === 1 ? "trade" : "trades"}`
                  : "Activity"}
            </span>
            {record && tradeCount > 0 && (
              <span>
                <WinLossRecord wins={record.wins} losses={record.losses} />
                {winRate ? <span className="text-muted-foreground"> · {winRate}</span> : null}
              </span>
            )}
          </div>
          {detail ? <DayStatRows detail={detail} currency={currency} fxRate={fxRate} /> : null}
          {rows.length > 0 ? (
            <ul
              className="max-h-52 overflow-y-auto overscroll-contain pt-1"
              aria-label={`Trades on ${date}`}
            >
              {rows.map((trade) => (
                <li
                  key={trade.id}
                  className="flex items-center gap-2 py-1 text-[12px] tabular-nums first:pt-0 last:pb-0"
                >
                  <span className="w-8 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {marketLabel(trade.instrument_type)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium tracking-wide text-foreground">
                    {trade.symbol}
                  </span>
                  {/* Direction and call/put read as one word: Long Call, Short Put… */}
                  <span className="shrink-0 uppercase text-[10px] tracking-wider text-muted-foreground">
                    {
                      resolveTradeDirection({
                        direction: trade.direction,
                        instrumentType: trade.instrument_type,
                        symbol: trade.symbol,
                      }).label
                    }
                  </span>
                  <span className="shrink-0 text-muted-foreground">{tradeTimeLabel(trade)}</span>
                  <span
                    className={cn(
                      "min-w-[4.25rem] shrink-0 text-right font-semibold",
                      trade.net_pnl != null ? pnlColor(trade.net_pnl) : "text-muted-foreground",
                    )}
                  >
                    {trade.net_pnl != null
                      ? fmtSignedMoney(trade.net_pnl * fxRate, currency, locale)
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {onOpenDayReview ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-full text-[12px]"
              onClick={() => onOpenDayReview(date)}
            >
              View day review →
            </Button>
          ) : null}
        </>
      ) : (
        <p className="text-[14px] text-muted-foreground">No trades</p>
      )}
    </div>
  );
}

/** The at-a-glance middle of the card: balances, flows, costs, quality. */
function DayStatRows({
  detail,
  currency,
  fxRate,
}: {
  detail: DayDetail;
  currency: string;
  fxRate: number;
}) {
  const locale = intlLocale();
  const moneyOf = (v: number) => fmtMoney(v * fxRate, currency, locale);
  const rows: { label: string; value: string }[] = [
    {
      label: "Balance",
      value: `${moneyOf(detail.startBalance)} → ${moneyOf(detail.endBalance)}`,
    },
    {
      label: "Deposits",
      value:
        detail.deposits === 0
          ? moneyOf(0)
          : fmtSignedMoney(detail.deposits * fxRate, currency, locale),
    },
    { label: "Comm & fees", value: moneyOf(detail.fees) },
  ];
  if (detail.winRate != null) {
    rows.push({ label: "Win rate", value: fmtPct(detail.winRate, locale) });
  }
  if (detail.profitFactor != null) {
    rows.push({
      label: "Profit factor",
      value: Number.isFinite(detail.profitFactor) ? detail.profitFactor.toFixed(2) : "∞",
    });
  }
  if (detail.expectancy != null) {
    rows.push({
      label: "Expectancy",
      value: fmtSignedMoney(detail.expectancy * fxRate, currency, locale),
    });
  }
  return (
    <dl className="m-0 flex flex-col gap-1 text-[12px] tabular-nums">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="m-0 text-right font-medium text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
