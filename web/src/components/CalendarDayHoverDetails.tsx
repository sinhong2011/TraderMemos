import type { DayRecord } from "../lib/calendar";
import { cn } from "../lib/cn";
import { fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";
import { pnlColor } from "./theme-tokens";
import { WinLossRecord } from "./WinLossRecord";
import { usePrivacyMode } from "../lib/displayPrefs";

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

export function CalendarDayHoverDetails({
  date,
  pnl,
  record,
  currency,
  fxRate = 1,
}: {
  date: string;
  pnl: number | null;
  record?: DayRecord;
  currency: string;
  fxRate?: number;
}) {
  usePrivacyMode();
  const locale = intlLocale();
  const trades = dayTradeCount(record);
  const winRate = dayWinRate(record);
  const hasPnl = pnl != null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-medium text-text-muted">{formatDayTitle(date, locale)}</p>
      {hasPnl ? (
        <>
          <p className={cn("text-[18px] font-semibold tabular-nums", pnlColor(pnl))}>
            {fmtSignedMoney(pnl * fxRate, currency, locale)}
          </p>
          <div className="flex flex-col gap-0.5 text-[13px] tabular-nums text-text-muted">
            <span>
              {trades > 0 ? `${trades} ${trades === 1 ? "trade" : "trades"}` : "Activity"}
            </span>
            {record && trades > 0 && (
              <span>
                <WinLossRecord wins={record.wins} losses={record.losses} />
                {winRate ? <span className="text-text-muted"> · {winRate}</span> : null}
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="text-[14px] text-text-dim">No trades</p>
      )}
    </div>
  );
}
