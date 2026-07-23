import type { DayRecord } from "../lib/calendar";
import type { Trade } from "../lib/api/types";
import { monthGrid } from "../lib/calendar";
import { cn } from "../lib/cn";
import { fmtSignedMoneyCompact } from "../lib/format";
import { intlLocale } from "../lib/locale";
import { CalendarDayHoverCard } from "./CalendarDayHoverCard";
import { pnlBgTint, pnlColor } from "./theme-tokens";
import { usePrivacyMode } from "../lib/displayPrefs";

function shortMonth(year: number, month: number, locale: string): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(locale, {
    month: "short",
    timeZone: "UTC",
  });
}

function YearDayCell({
  date,
  pnl,
  record,
  currency,
  fxRate,
  trades,
}: {
  date: string;
  pnl: number | null;
  record?: DayRecord;
  currency: string;
  fxRate: number;
  trades?: Trade[];
}) {
  const cellClass = cn(
    "block h-full min-h-0 min-w-0 rounded-sharp transition-[filter,box-shadow,opacity] duration-150",
    "group-hover/card:brightness-125",
    pnl != null && "hover:brightness-150 hover:ring-1 hover:ring-accent/50",
  );
  const cellStyle = {
    background:
      pnl != null
        ? pnlBgTint(pnl, { minOpacity: 0.1, maxOpacity: 0.55, scale: 450 })
        : "var(--color-bg-elevated)",
  } as const;

  if (pnl == null) {
    return <div className={cellClass} style={cellStyle} />;
  }

  return (
    <CalendarDayHoverCard
      date={date}
      pnl={pnl}
      record={record}
      currency={currency}
      fxRate={fxRate}
      trades={trades}
      className={cellClass}
      style={cellStyle}
    />
  );
}

function YearMonthCard({
  year,
  month,
  dailyPnl,
  dayRecords,
  tradesByDay,
  tradeCount,
  currency,
  fxRate,
  onSelect,
  index,
}: {
  year: number;
  month: number;
  dailyPnl: Record<string, number>;
  dayRecords: Record<string, DayRecord>;
  tradesByDay?: Map<string, Trade[]>;
  tradeCount: number;
  currency: string;
  fxRate: number;
  onSelect: (month: number) => void;
  index: number;
}) {
  usePrivacyMode();
  const locale = intlLocale();
  const grid = monthGrid(year, month, dailyPnl);
  const weeks = grid.weeks.filter((week) => week.some((c) => c != null));
  const total = grid.monthTotal;
  const hasTrades = tradeCount > 0 || weeks.some((week) => week.some((c) => c?.pnl != null));
  const now = new Date();
  const isFuture =
    year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const label = `${shortMonth(year, month, locale)} ${year}${
    tradeCount > 0 ? `, ${tradeCount} trades` : ""
  }`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(month)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(month);
        }
      }}
      aria-label={label}
      style={{ animationDelay: `${index * 35}ms` }}
      className={cn(
        "group/card relative flex h-full min-h-0 cursor-pointer flex-col justify-center overflow-hidden rounded-card bg-bg px-3 py-3 text-left sm:justify-start sm:px-4 sm:py-4",
        "transition-[background-color,box-shadow] duration-150 ease-out",
        "hover:bg-bg-elevated hover:shadow-[0_12px_32px_-18px_var(--color-accent-glow)]",
        "active:bg-bg-hover active:shadow-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong",
        "motion-reduce:animate-none",
        "animate-[year-card-in_250ms_var(--ease-out)_both]",
        isFuture && "opacity-50",
      )}
      data-month={monthKey}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 ease-out group-hover/card:opacity-100"
        style={{
          background: "radial-gradient(90% 70% at 50% 0%, var(--color-accent-bg), transparent 65%)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 h-px opacity-0 transition-opacity duration-200 ease-out group-hover/card:opacity-100 sm:inset-x-4"
        style={{
          background: "linear-gradient(90deg, transparent, var(--color-accent-glow), transparent)",
        }}
      />

      <p className="relative shrink-0 text-center text-[13px] font-medium text-text transition-colors duration-150 group-hover/card:text-accent">
        {shortMonth(year, month, locale)}
      </p>

      <div
        className="relative mt-3 hidden min-h-0 w-full flex-1 gap-1 sm:grid"
        style={{
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gridTemplateRows: `repeat(${Math.max(weeks.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {weeks.flatMap((week, wi) =>
          week.map((cell, di) => {
            if (!cell) {
              return <div key={`${wi}-${di}`} className="min-h-0 min-w-0" />;
            }
            return (
              <YearDayCell
                key={cell.date}
                date={cell.date}
                pnl={cell.pnl}
                record={dayRecords[cell.date]}
                currency={currency}
                fxRate={fxRate}
                trades={tradesByDay?.get(cell.date)}
              />
            );
          }),
        )}
      </div>

      <div className="relative mt-3 flex shrink-0 flex-col items-center gap-0.5">
        <p
          className={cn(
            "text-[14px] font-semibold tabular-nums",
            hasTrades ? pnlColor(total) : "text-text-dim",
          )}
        >
          {hasTrades ? fmtSignedMoneyCompact(total * fxRate, currency, locale) : "—"}
        </p>
        <p className="text-[11px] tabular-nums text-text-muted">
          {tradeCount > 0 ? `${tradeCount} ${tradeCount === 1 ? "trade" : "trades"}` : "No trades"}
        </p>
      </div>
    </div>
  );
}

export interface CalendarYearViewProps {
  year: number;
  dailyPnl: Record<string, number>;
  /** Closed-trade counts keyed by "YYYY-MM". */
  tradesByMonth?: Record<string, number>;
  /** Win/loss records keyed by "YYYY-MM-DD". */
  dayRecords?: Record<string, DayRecord>;
  /** Day trades for hover-card rows, keyed by "YYYY-MM-DD". */
  tradesByDay?: Map<string, Trade[]>;
  loading?: boolean;
  error?: boolean;
  currency: string;
  fxRate?: number;
  onSelectMonth: (month: number) => void;
}

export function CalendarYearView({
  year,
  dailyPnl,
  tradesByMonth = {},
  dayRecords = {},
  tradesByDay,
  loading,
  error,
  currency,
  fxRate = 1,
  onSelectMonth,
}: CalendarYearViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pb-4 md:px-4">
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-[12px] text-text-muted">
          Loading…
        </div>
      ) : error ? (
        <p className="p-4 text-xs text-loss">Failed to load daily P&L.</p>
      ) : (
        <div
          key={year}
          className="grid min-h-0 flex-1 grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:auto-rows-fr"
        >
          {Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const key = `${year}-${String(m).padStart(2, "0")}`;
            return (
              <YearMonthCard
                key={key}
                year={year}
                month={m}
                index={i}
                dailyPnl={dailyPnl}
                dayRecords={dayRecords}
                tradesByDay={tradesByDay}
                tradeCount={tradesByMonth[key] ?? 0}
                currency={currency}
                fxRate={fxRate}
                onSelect={onSelectMonth}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
