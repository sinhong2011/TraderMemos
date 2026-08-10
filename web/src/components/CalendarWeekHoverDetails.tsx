import type { WeekDetail } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtMoney, fmtPct, fmtSignedMoney, fmtSignedPct } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { pnlColor } from "./theme-tokens";
import { Button } from "./ui/button";

function formatWeekRange(firstDate: string, lastDate: string, locale: string): string {
  const start = new Date(`${firstDate}T12:00:00Z`);
  const end = new Date(`${lastDate}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).formatRange(start, end);
}

function formatDayLabel(isoDate: string, locale: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function CalendarWeekHoverDetails({
  firstDate,
  lastDate,
  weekNumber,
  pnl,
  hasData,
  currency,
  fxRate = 1,
  detail,
  onOpenWeekReview,
}: {
  firstDate: string | null;
  lastDate: string | null;
  weekNumber: number | null;
  pnl: number;
  hasData: boolean;
  currency: string;
  fxRate?: number;
  detail?: WeekDetail;
  onOpenWeekReview?: () => void;
}) {
  usePrivacyMode();
  const locale = intlLocale();

  if (!hasData) {
    return (
      <div className="flex min-w-[14rem] flex-col gap-2.5">
        <p className="text-[14px] text-muted-foreground">No trades</p>
      </div>
    );
  }

  const title = firstDate && lastDate ? formatWeekRange(firstDate, lastDate, locale) : "Week";

  return (
    <div className="flex min-w-[14rem] flex-col gap-2.5">
      <p className="text-[13px] font-medium text-muted-foreground">
        {title}
        {weekNumber != null ? (
          <span className="text-muted-foreground/80"> · Week {weekNumber}</span>
        ) : null}
      </p>
      <p className={cn("text-[18px] font-semibold tabular-nums", pnlColor(pnl))}>
        {fmtSignedMoney(pnl * fxRate, currency, locale)}
        {detail?.pct != null ? (
          <span className="ml-1.5 text-[13px] opacity-80">{fmtSignedPct(detail.pct, locale)}</span>
        ) : null}
      </p>
      {detail ? <WeekStatRows detail={detail} currency={currency} fxRate={fxRate} /> : null}
      {detail ? (
        <p className="m-0 text-[12px] tabular-nums text-muted-foreground">
          {detail.tradingDays} {detail.tradingDays === 1 ? "trading day" : "trading days"}
          {" · "}
          {detail.trades} {detail.trades === 1 ? "trade" : "trades"}
        </p>
      ) : null}
      {onOpenWeekReview ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full text-[12px]"
          onClick={onOpenWeekReview}
        >
          View week review →
        </Button>
      ) : null}
    </div>
  );
}

function WeekStatRows({
  detail,
  currency,
  fxRate,
}: {
  detail: WeekDetail;
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
  if (detail.bestDay) {
    rows.push({
      label: "Best",
      value: `${formatDayLabel(detail.bestDay.date, locale)} · ${fmtSignedMoney(detail.bestDay.pnl * fxRate, currency, locale)}`,
    });
  }
  if (detail.worstDay) {
    rows.push({
      label: "Worst",
      value: `${formatDayLabel(detail.worstDay.date, locale)} · ${fmtSignedMoney(detail.worstDay.pnl * fxRate, currency, locale)}`,
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
