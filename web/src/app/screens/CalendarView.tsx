import { CalendarDays } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { CalendarDayHoverCard } from "@/components/CalendarDayHoverCard";
import { CalendarYearView } from "@/components/CalendarYearView";
import { Card } from "@/components/Card";
import { DayTradesDrawer } from "@/components/DayTradesDrawer";
import { WinLossRecord } from "@/components/WinLossRecord";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { MonthPicker } from "@/components/MonthPicker";
import { Page } from "@/components/Page";
import { PeriodNav } from "@/components/PeriodNav";
import { SegmentedControl } from "@/components/SegmentedControl";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";
import { Button } from "@/components/ui/button";
import {
  heroPnlClass,
  pnlBgTint,
  pnlColor,
  TINTED_LABEL,
  TINTED_LABEL_SUBTLE,
} from "@/components/theme-tokens";

import type { Account, CashTransaction, Summary, Trade } from "@/lib/api/types";
import { netDeposits } from "@/lib/headerStats";
import { type DayRecord, dayKeyInTz, monthGrid, tradeDayKey, weekSummaries } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { fmtPct, fmtSignedMoney, fmtSignedMoneyCompact } from "@/lib/format";
import { useMoneyFx } from "@/lib/hooks/useMoneyFx";
import { intlLocale } from "@/lib/locale";
import { resolveMarketTimezone, useDisplayPrefs, usePrivacyMode } from "@/lib/displayPrefs";

const DOW_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Weekend day-of-week indexes (Sun=0, Sat=6) — hidden below `md` in favor of taller Mon–Fri cells. */
const WEEKEND_DOW = new Set([0, 6]);
// Below `md`: Mon–Fri + week summary. From `md` up: full 7 days + week summary.
// The mobile week column is kept narrow so the five day cells keep enough width
// for the compact P&L figure.
const GRID_COLS_CLASS =
  "grid-cols-[repeat(5,minmax(0,1fr))_minmax(3.5rem,0.75fr)] md:[grid-template-columns:repeat(7,minmax(0,1fr))_minmax(7.5rem,0.9fr)]";

const VIEW_OPTS = [
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
] as const;

export type CalendarMode = "month" | "year";

export interface CalendarViewProps {
  dailyPnl: Record<string, number>;
  dailyLoading: boolean;
  dailyError: boolean;
  /** Year-scoped daily PnL for year mode (full Jan–Dec). */
  yearDailyPnl?: Record<string, number>;
  yearDailyLoading?: boolean;
  yearDailyError?: boolean;
  /** Closed-trade counts keyed by"YYYY-MM". */
  yearTradesByMonth?: Record<string, number>;
  /** Year-scoped win/loss records keyed by"YYYY-MM-DD". */
  yearDayRecords?: Record<string, DayRecord>;
  records: Record<string, DayRecord>;
  /** Month-scoped trades for hover-card execution rows. */
  monthTrades?: Trade[];
  /** Year-scoped trades for year-view hover cards. */
  yearTradeList?: Trade[];
  monthSummary: Summary | undefined;
  accounts: Account[];
  /** Full cash ledger for the scope; funds the %-of-account basis. */
  cashTx: CashTransaction[];
  selectedAccountId: string | undefined;
  year: number;
  month: number;
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onPrevYear: () => void;
  onNextYear: () => void;
  onToday: () => void;
  onJumpToMonth: (year: number, month: number) => void;
  canGoNextMonth: boolean;
  canGoNextYear: boolean;
  selectedDay: string | null;
  onSelectDay: (date: string | null) => void;
  dayTrades: Trade[];
  dayTradesLoading: boolean;
  dayTradesError: boolean;
  currency: string;
  /** Quick peek drawer */
  onSelectTrade: (t: Trade) => void;
  onOpenDayReview?: (day: string) => void;
}

/** Softer P&L ink for heatmap cells — teal/rose, less neon than --color-profit/loss. */
function dayColor(pnl: number): string {
  return pnl >= 0 ? "rgb(82, 202, 150)" : "rgb(235, 75, 104)";
}

function todayString(tz?: string): string {
  return dayKeyInTz(new Date().toISOString(), tz);
}

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

export function CalendarView({
  dailyPnl,
  dailyLoading,
  dailyError,
  yearDailyPnl = {},
  yearDailyLoading = false,
  yearDailyError = false,
  yearTradesByMonth = {},
  yearDayRecords = {},
  records,
  monthTrades = [],
  yearTradeList = [],
  monthSummary,
  accounts,
  cashTx,
  selectedAccountId,
  year,
  month,
  mode,
  onModeChange,
  onPrevMonth,
  onNextMonth,
  onPrevYear,
  onNextYear,
  onToday,
  onJumpToMonth,
  canGoNextMonth,
  canGoNextYear,
  selectedDay,
  onSelectDay,
  dayTrades,
  dayTradesLoading,
  dayTradesError,
  currency,
  onSelectTrade,
  onOpenDayReview,
}: CalendarViewProps) {
  usePrivacyMode();
  const tradeDateBasis = useDisplayPrefs((s) => s.tradeDateBasis);
  const marketTz = resolveMarketTimezone(useDisplayPrefs((s) => s.marketTimezone));
  const [monthSummaryOpen, setMonthSummaryOpen] = useState(false);
  const [yearSummaryOpen, setYearSummaryOpen] = useState(false);
  const { currency: displayCurrency, rate } = useMoneyFx(currency);
  const fxRate = rate ?? 1;
  const money = (v: number) => v * fxRate;
  const grid = monthGrid(year, month, dailyPnl);
  const weeks = weekSummaries(grid.weeks, records);
  const today = todayString(marketTz);

  const monthTradesByDay = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const trade of monthTrades) {
      const key = tradeDayKey(trade, tradeDateBasis, marketTz);
      if (!key) continue;
      const list = map.get(key);
      if (list) list.push(trade);
      else map.set(key, [trade]);
    }
    return map;
  }, [monthTrades, tradeDateBasis, marketTz]);

  const yearTradesByDay = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const trade of yearTradeList) {
      const key = tradeDayKey(trade, tradeDateBasis, marketTz);
      if (!key) continue;
      const list = map.get(key);
      if (list) list.push(trade);
      else map.set(key, [trade]);
    }
    return map;
  }, [yearTradeList, tradeDateBasis, marketTz]);

  // %-basis is net deposits from the cash ledger — starting_balance is metadata
  // that already lives in the ledger as the "Opening balance" deposit.
  const starting = netDeposits({ accounts, accountId: selectedAccountId, cashTx });
  const monthPnl = monthSummary?.net_pnl ?? grid.monthTotal;
  const monthPct = starting > 0 ? (monthPnl / starting) * 100 : null;

  const hasAnyPnl = Object.keys(dailyPnl).some((key) => {
    const [y, m] = key.split("-").map(Number);
    return y === year && m === month;
  });

  const tradingDays = Object.keys(dailyPnl).filter((key) => {
    const [y, m] = key.split("-").map(Number);
    return y === year && m === month;
  }).length;

  const yearPnlTotal = Object.entries(yearDailyPnl).reduce((sum, [key, v]) => {
    if (key.startsWith(`${year}-`)) return sum + v;
    return sum;
  }, 0);
  const yearPct = starting > 0 ? (yearPnlTotal / starting) * 100 : null;

  const yearTradingDays = Object.keys(yearDailyPnl).filter((key) =>
    key.startsWith(`${year}-`),
  ).length;
  const yearTrades = Object.entries(yearTradesByMonth).reduce(
    (sum, [key, count]) => (key.startsWith(`${year}-`) ? sum + count : sum),
    0,
  );
  const yearWinLoss = Object.entries(yearDayRecords).reduce(
    (acc, [date, rec]) => {
      if (!date.startsWith(`${year}-`)) return acc;
      return { wins: acc.wins + rec.wins, losses: acc.losses + rec.losses };
    },
    { wins: 0, losses: 0 },
  );
  const yearWinRate =
    yearWinLoss.wins + yearWinLoss.losses > 0
      ? yearWinLoss.wins / (yearWinLoss.wins + yearWinLoss.losses)
      : null;

  const visibleWeekIndexes = grid.weeks
    .map((week, wi) => (week.every((c) => c == null) ? -1 : wi))
    .filter((wi) => wi >= 0);

  const modeAnimKey = useRef(0);
  function changeMode(next: CalendarMode) {
    if (next === mode) return;
    modeAnimKey.current += 1;
    const apply = () => onModeChange(next);
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => void;
    };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion && typeof doc.startViewTransition === "function") {
      doc.startViewTransition(apply);
      return;
    }
    apply();
  }

  return (
    <>
      <Page fill className="min-h-[calc(100svh-52px)]">
        <Card fill flush className="min-h-0">
          {/* One row at every width: mode toggle, period nav, period total. Below
              `sm` the row is space-between and the nav label shortens/truncates;
              from `sm` up equal side columns center the nav exactly. All three
              controls share the same height (`h-8` / `sm:h-7`). */}
          <div
            className={cn(
              "grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 px-3 pt-3 pb-2",
              "sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3 sm:px-4",
            )}
          >
            {/* Tighter segment padding below `sm` buys the nav enough room for the
                full "Jul 2026" label at 375px. */}
            <SegmentedControl
              ariaLabel="Calendar mode"
              options={[...VIEW_OPTS]}
              value={mode}
              onChange={(v) => changeMode(v as CalendarMode)}
              className="h-8 justify-self-start [&_button]:px-2 sm:h-7 sm:[&_button]:px-2.5"
            />

            <div className="flex min-w-0 justify-center">
              {mode === "month" ? (
                <MonthPicker
                  year={year}
                  month={month}
                  onPrevMonth={onPrevMonth}
                  onNextMonth={onNextMonth}
                  onToday={onToday}
                  onJumpToMonth={onJumpToMonth}
                  canGoNext={canGoNextMonth}
                />
              ) : (
                <PeriodNav
                  onPrev={onPrevYear}
                  onNext={onNextYear}
                  prevLabel="Previous year"
                  nextLabel="Next year"
                  canGoNext={canGoNextYear}
                >
                  <span className="w-14 text-center text-[13px] font-semibold tabular-nums tracking-[-0.01em] text-foreground sm:w-16">
                    {year}
                  </span>
                </PeriodNav>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={mode === "month" ? "Month summary" : "Year summary"}
              onClick={() =>
                mode === "month" ? setMonthSummaryOpen(true) : setYearSummaryOpen(true)
              }
              className={cn(
                "h-8 justify-self-end px-2 text-[12px] font-semibold tabular-nums",
                "sm:h-7 sm:px-2.5 sm:text-[13px]",
                (mode === "month" ? monthPnl : yearPnlTotal) >= 0
                  ? "bg-profit/10 text-profit hover:bg-profit/16"
                  : "bg-destructive/10 text-destructive hover:bg-destructive/16",
              )}
            >
              {fmtSignedMoneyCompact(
                money(mode === "month" ? monthPnl : yearPnlTotal),
                displayCurrency,
                intlLocale(),
              )}
            </Button>
          </div>

          <div
            key={`${mode}-${modeAnimKey.current}`}
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              "animate-[calendar-mode-in_250ms_cubic-bezier(0.16, 1, 0.3, 1)_both]",
              "motion-reduce:animate-none",
            )}
            style={{ viewTransitionName: "calendar-mode-panel" }}
          >
            {mode === "year" ? (
              <CalendarYearView
                year={year}
                dailyPnl={yearDailyPnl}
                tradesByMonth={yearTradesByMonth}
                dayRecords={yearDayRecords}
                tradesByDay={yearTradesByDay}
                loading={yearDailyLoading}
                error={yearDailyError}
                currency={displayCurrency}
                fxRate={fxRate}
                onSelectMonth={(m) => {
                  onJumpToMonth(year, m);
                  changeMode("month");
                }}
              />
            ) : dailyLoading ? (
              <CardSkeleton
                className="m-4 min-h-[320px] flex-1"
                mediaClassName="min-h-[280px] flex-1"
              />
            ) : dailyError ? (
              <p className="p-4 text-xs text-destructive">Failed to load daily P&L.</p>
            ) : !hasAnyPnl ? (
              <div className="flex flex-1 items-center justify-center p-3 md:p-4">
                <EmptyState
                  title="No trades this month"
                  hint="Navigate to a month with trades to see the P&L heatmap."
                  icon={<CalendarDays size={32} strokeWidth={1.5} />}
                />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col p-3 md:p-4">
                <div className={cn("mb-1.5 grid shrink-0 gap-1 md:gap-1.5", GRID_COLS_CLASS)}>
                  {DOW_HEADERS.map((d, di) => (
                    <div
                      key={d}
                      className={cn(
                        "px-1 py-1 text-center text-[11px] font-medium text-muted-foreground",
                        WEEKEND_DOW.has(di) && "hidden md:block",
                      )}
                    >
                      {d}
                    </div>
                  ))}
                  <div className="px-1 py-1 text-center text-[11px] font-medium text-muted-foreground">
                    Week
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                  {visibleWeekIndexes.map((wi) => {
                    const week = grid.weeks[wi];
                    const ws = weeks[wi];
                    return (
                      <div
                        key={wi}
                        className={cn(
                          "grid min-h-[76px] flex-1 gap-1 md:min-h-[88px] md:gap-1.5",
                          GRID_COLS_CLASS,
                        )}
                      >
                        {week.map((cell, di) => {
                          if (!cell) {
                            return (
                              <div
                                key={di}
                                className={cn(
                                  "h-full min-h-0",
                                  WEEKEND_DOW.has(di) && "hidden md:block",
                                )}
                              />
                            );
                          }
                          const dayNum = Number(cell.date.slice(8, 10));
                          const hasPnl = cell.pnl != null;
                          const rec = records[cell.date];
                          const trades = dayTradeCount(rec);
                          const winRate = dayWinRate(rec);
                          const isSelected = selectedDay === cell.date;
                          const isToday = cell.date === today;
                          const dayBody = (
                            <>
                              <span
                                className={cn(
                                  "self-end text-[11px] font-medium tabular-nums",
                                  isToday
                                    ? "inline-flex size-5 items-center justify-center rounded-full bg-primary font-semibold text-background"
                                    : TINTED_LABEL_SUBTLE,
                                )}
                              >
                                {dayNum}
                              </span>
                              {hasPnl ? (
                                <span className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5">
                                  <span
                                    className={cn(
                                      // Steps up with the cell: five-column mobile cells leave
                                      // ~43px of content box, barely wider than `-$213.4` at 10px.
                                      "max-w-full truncate text-[10px] font-semibold tracking-[-0.04em] tabular-nums",
                                      "@min-[3rem]/day:text-[11px] @min-[3rem]/day:tracking-[-0.02em]",
                                      "@min-[5rem]/day:text-[13px]",
                                      "@min-[6.5rem]/day:text-base @min-[8.5rem]/day:text-lg",
                                    )}
                                    style={{ color: dayColor(cell.pnl!) }}
                                  >
                                    {fmtSignedMoneyCompact(
                                      money(cell.pnl!),
                                      displayCurrency,
                                      intlLocale(),
                                    )}
                                  </span>
                                  {/* The count is implied by the W/L record below, so it only
                                      earns a line once the cell can spell it out unclipped. */}
                                  {trades > 0 && (
                                    <span
                                      className={cn(
                                        "hidden max-w-full truncate text-[10px] tabular-nums @min-[3rem]/day:block",
                                        TINTED_LABEL,
                                      )}
                                    >
                                      {trades} {trades === 1 ? "trade" : "trades"}
                                    </span>
                                  )}
                                  {winRate && (
                                    <span
                                      className={cn(
                                        "max-w-full truncate text-[10px] tabular-nums",
                                        TINTED_LABEL_SUBTLE,
                                      )}
                                    >
                                      <WinLossRecord
                                        wins={rec!.wins}
                                        losses={rec!.losses}
                                        className="opacity-90"
                                      />
                                      <span
                                        className={cn(
                                          "hidden @min-[4.5rem]/day:inline",
                                          TINTED_LABEL_SUBTLE,
                                        )}
                                      >
                                        {" "}
                                        · {winRate}
                                      </span>
                                    </span>
                                  )}
                                </span>
                              ) : null}
                            </>
                          );
                          const dayClass = cn(
                            // `sm:h-full` must beat Button size (`sm:h-8`) so day cells fill the row.
                            "relative flex h-full min-h-0 w-full flex-col justify-start overflow-hidden rounded-md px-0.5 py-1 text-left transition-colors duration-150 sm:h-full md:px-2 md:py-1.5",
                            // Cell contents key off the cell's own width: the grid drops to five
                            // columns below `md`, so viewport breakpoints don't track how much
                            // room a day actually has. Padding stays viewport-driven — sizing the
                            // container from its own query would feed back into the query.
                            "@container/day",
                            hasPnl ? "cursor-pointer" : "cursor-default",
                            isSelected && "ring-1 ring-primary ring-inset",
                            WEEKEND_DOW.has(di) && "hidden md:flex",
                          );
                          const dayStyle = {
                            background: hasPnl ? pnlBgTint(cell.pnl!) : "var(--sidebar)",
                          };
                          const dayAria = hasPnl
                            ? `${cell.date} ${fmtSignedMoney(money(cell.pnl!), displayCurrency, intlLocale())}`
                            : cell.date;

                          if (!hasPnl) {
                            return (
                              <Button
                                key={di}
                                type="button"
                                variant="ghost"
                                aria-label={dayAria}
                                aria-current={isToday ? "date" : undefined}
                                className={dayClass}
                                style={dayStyle}
                              >
                                {dayBody}
                              </Button>
                            );
                          }

                          return (
                            <CalendarDayHoverCard
                              key={di}
                              date={cell.date}
                              pnl={cell.pnl!}
                              record={rec}
                              currency={displayCurrency}
                              fxRate={fxRate}
                              trades={monthTradesByDay.get(cell.date) ?? []}
                              ariaLabel={dayAria}
                              ariaCurrent={isToday ? "date" : undefined}
                              className={dayClass}
                              style={dayStyle}
                              delay={160}
                              closeDelay={100}
                              sideOffset={8}
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => onSelectDay(isSelected ? null : cell.date)}
                                />
                              }
                            >
                              {dayBody}
                            </CalendarDayHoverCard>
                          );
                        })}

                        <div
                          className={cn(
                            "relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md px-1.5 py-1 md:px-2.5 md:py-1.5",
                            "@container/week",
                            !ws.hasData && "bg-muted",
                          )}
                          style={ws.hasData ? { background: pnlBgTint(ws.pnl) } : undefined}
                        >
                          {ws.weekNumber != null && (
                            <span
                              className={cn(
                                "max-w-full truncate self-end text-[10px] font-medium @min-[6rem]/week:text-[11px]",
                                TINTED_LABEL_SUBTLE,
                              )}
                            >
                              <span className="@min-[6rem]/week:hidden">W{ws.weekNumber}</span>
                              <span className="hidden @min-[6rem]/week:inline">
                                Week {ws.weekNumber}
                              </span>
                            </span>
                          )}
                          {ws.hasData ? (
                            <span className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 @min-[6rem]/week:gap-1.5">
                              <span
                                className={cn(
                                  "max-w-full truncate text-[11px] font-semibold tracking-[-0.02em] tabular-nums",
                                  "@min-[6rem]/week:text-base @min-[7.5rem]/week:text-lg",
                                )}
                                style={{ color: dayColor(ws.pnl) }}
                              >
                                {fmtSignedMoneyCompact(
                                  money(ws.pnl),
                                  displayCurrency,
                                  intlLocale(),
                                )}
                              </span>
                              {ws.wins + ws.losses > 0 ? (
                                <span className="max-w-full truncate text-[10px] tabular-nums">
                                  <WinLossRecord wins={ws.wins} losses={ws.losses} />
                                </span>
                              ) : null}
                              <span
                                className={cn(
                                  "max-w-full truncate text-[10px] tabular-nums",
                                  TINTED_LABEL_SUBTLE,
                                )}
                              >
                                {ws.daysWithTrades} {ws.daysWithTrades === 1 ? "day" : "days"}
                              </span>
                            </span>
                          ) : (
                            <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>
      </Page>

      <DayTradesDrawer
        selectedDay={selectedDay}
        onClose={() => onSelectDay(null)}
        dayTrades={dayTrades}
        dayTradesLoading={dayTradesLoading}
        dayTradesError={dayTradesError}
        currency={displayCurrency}
        fxRate={fxRate}
        onSelectTrade={onSelectTrade}
        onOpenDayReview={onOpenDayReview}
      />

      <Modal
        open={monthSummaryOpen}
        onOpenChange={setMonthSummaryOpen}
        title={formatMonthTitle(year, month)}
        className="max-w-[min(380px,94vw)]"
        bodyClassName="gap-5"
      >
        <PeriodSummaryBody
          pnl={money(monthPnl)}
          pct={monthPct}
          currency={displayCurrency}
          stats={[
            { label: "Days", value: String(tradingDays) },
            {
              label: "Trades",
              value: monthSummary ? String(monthSummary.total_trades) : "—",
            },
            {
              label: "Win rate",
              value: monthSummary ? fmtPct(monthSummary.win_rate, intlLocale()) : "—",
            },
            {
              label: "Profit factor",
              value: monthSummary
                ? monthSummary.profit_factor === 0
                  ? "—"
                  : monthSummary.profit_factor.toFixed(2)
                : "—",
            },
          ]}
        />
      </Modal>

      <Modal
        open={yearSummaryOpen}
        onOpenChange={setYearSummaryOpen}
        title={String(year)}
        className="max-w-[min(380px,94vw)]"
        bodyClassName="gap-5"
      >
        <PeriodSummaryBody
          pnl={money(yearPnlTotal)}
          pct={yearPct}
          currency={displayCurrency}
          stats={[
            { label: "Days", value: String(yearTradingDays) },
            { label: "Trades", value: String(yearTrades) },
            {
              label: "Win rate",
              value: yearWinRate != null ? fmtPct(yearWinRate, intlLocale()) : "—",
            },
          ]}
        />
      </Modal>
    </>
  );
}

function formatMonthTitle(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(intlLocale(), {
    month: "long",
    year: "numeric",
  });
}

function PeriodSummaryBody({
  pnl,
  pct,
  currency,
  stats,
}: {
  pnl: number;
  pct?: number | null;
  currency: string;
  stats: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <div
        className="relative overflow-hidden rounded-md px-4 py-7 text-center"
        style={{ background: pnlBgTint(pnl, { minOpacity: 0.07, maxOpacity: 0.2, scale: 400 }) }}
      >
        <p className="m-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Net P&L
        </p>
        <p className={cn("m-0 mt-2.5", heroPnlClass(pnl), pnl > 0 && "", pnl < 0 && "")}>
          {fmtSignedMoneyCompact(pnl, currency, intlLocale())}
        </p>
        {pct != null ? (
          <p className={cn("m-0 mt-2 text-[15px] font-semibold tabular-nums", pnlColor(pct))}>
            {pct >= 0 ? "+" : ""}
            {pct.toFixed(1)}%
          </p>
        ) : null}
      </div>

      <div className={cn("grid gap-2", stats.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {stats.map((stat) => (
          <PeriodSummaryStat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>
    </div>
  );
}

function PeriodSummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-md bg-background px-3 py-3">
      <p className="m-0 truncate text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="m-0 text-[18px] font-semibold tracking-[-0.02em] tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
