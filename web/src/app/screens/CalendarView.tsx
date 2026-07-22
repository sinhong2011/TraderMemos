import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { CalendarDayHoverCard } from "../../components/CalendarDayHoverCard";
import { CalendarYearView } from "../../components/CalendarYearView";
import { Card } from "../../components/Card";
import { WinLossRecord } from "../../components/WinLossRecord";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "../../components/Drawer";
import { EmptyState } from "../../components/EmptyState";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "../../components/Item";
import { Modal } from "../../components/Modal";
import { MonthPicker } from "../../components/MonthPicker";
import { Page } from "../../components/Page";
import { Pill } from "../../components/Pill";
import { SegmentedControl } from "../../components/SegmentedControl";
import { Skeleton } from "../../components/Skeleton";
import { Button } from "../../components/ui/button";
import { pnlBgTint, pnlColor, heroPnlClass } from "../../components/theme-tokens";

import { TradeRowMenu } from "../../components/TradeRowMenu";
import { marketLabel, tradeStatus } from "../../components/tradeColumns";
import type { Account, Summary, Trade } from "../../lib/api/types";
import { type DayRecord, monthGrid, weekSummaries } from "../../lib/calendar";
import { cn } from "../../lib/cn";
import {
  fmtDuration,
  fmtMoney,
  fmtPct,
  fmtSignedMoney,
  fmtSignedMoneyCompact,
} from "../../lib/format";
import { useMoneyFx } from "../../lib/hooks/useMoneyFx";
import { intlLocale } from "../../lib/locale";
import { usePrivacyMode } from "../../lib/displayPrefs";

const DOW_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Weekend day-of-week indexes (Sun=0, Sat=6) — hidden below `md` in favor of taller Mon–Fri cells. */
const WEEKEND_DOW = new Set([0, 6]);
// Below `md`: Mon–Fri + week summary. From `md` up: full 7 days + week summary.
const GRID_COLS_CLASS =
  "grid-cols-[repeat(5,minmax(0,1fr))_minmax(4.75rem,0.85fr)] md:[grid-template-columns:repeat(7,minmax(0,1fr))_minmax(7.5rem,0.9fr)]";

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
  /** Closed-trade counts keyed by "YYYY-MM". */
  yearTradesByMonth?: Record<string, number>;
  /** Year-scoped win/loss records keyed by "YYYY-MM-DD". */
  yearDayRecords?: Record<string, DayRecord>;
  records: Record<string, DayRecord>;
  monthSummary: Summary | undefined;
  accounts: Account[];
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
  /** Navigate to /trades/:id */
  onOpenFullPage: (t: Trade) => void;
  onFilterSymbol?: (symbol: string) => void;
  /** Called after a successful row delete (e.g. close peek drawer). */
  onDeleted?: (t: Trade) => void;
}

/** Softer P&L ink for heatmap cells — teal/rose, less neon than --color-profit/loss. */
function dayColor(pnl: number): string {
  return pnl >= 0 ? "rgb(82, 202, 150)" : "rgb(235, 75, 104)";
}

function todayString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDayTitle(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(intlLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function tradeCardMeta(trade: Trade, currency: string, fxRate = 1): string {
  const qty = trade.qty_opened.toFixed(trade.qty_opened % 1 === 0 ? 0 : 2);
  const entry = fmtMoney(trade.avg_entry_price * fxRate, currency, intlLocale());
  const exit =
    trade.avg_exit_price != null
      ? fmtMoney(trade.avg_exit_price * fxRate, currency, intlLocale())
      : "—";
  const hold = fmtDuration(trade.time_in_trade_secs);
  const holdPart = hold === "-" ? null : hold;
  return [qty, `${entry} → ${exit}`, holdPart].filter(Boolean).join(" · ");
}

function DayTradeItem({
  trade,
  currency,
  fxRate = 1,
  onSelectTrade,
  onOpenFullPage,
  onFilterSymbol,
  onDeleted,
}: {
  trade: Trade;
  currency: string;
  fxRate?: number;
  onSelectTrade: (t: Trade) => void;
  onOpenFullPage: (t: Trade) => void;
  onFilterSymbol?: (symbol: string) => void;
  onDeleted?: (t: Trade) => void;
}) {
  usePrivacyMode();
  const status = tradeStatus(trade);
  const isLong = trade.direction === "long";
  const DirIcon = isLong ? ArrowUpRight : ArrowDownRight;

  return (
    <Item
      variant="default"
      size="default"
      className={cn(
        "w-full cursor-pointer gap-3 border-transparent bg-bg-hover px-3.5 py-3",
        "hover:bg-bg-panel focus-visible:bg-bg-panel",
      )}
      tabIndex={0}
      onClick={() => onSelectTrade(trade)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectTrade(trade);
        }
      }}
    >
      <ItemMedia
        variant="icon"
        aria-hidden
        className={cn(
          "size-9 self-center",
          isLong ? "bg-tint-pos text-profit" : "bg-tint-neg text-loss",
        )}
      >
        <DirIcon size={16} strokeWidth={2} aria-label={isLong ? "long" : "short"} />
      </ItemMedia>
      <ItemContent className="gap-1">
        <ItemTitle className="gap-2 text-[15px]">
          <span className="font-semibold tracking-tight text-accent">{trade.symbol}</span>
          <Pill tone={status.tone} title={status.label === "BE" ? "Break-even" : undefined}>
            {status.label}
          </Pill>
          <span className="text-[12px] font-medium tracking-wide text-text-muted">
            {marketLabel(trade.instrument_type)}
          </span>
        </ItemTitle>
        <ItemDescription className="text-[13px] text-text-muted">
          {tradeCardMeta(trade, currency, fxRate)}
        </ItemDescription>
      </ItemContent>
      <ItemContent className="items-end gap-0.5 text-right">
        {trade.net_pnl != null ? (
          <>
            <ItemTitle
              className={cn("text-[15px] font-semibold tabular-nums", pnlColor(trade.net_pnl))}
            >
              {fmtSignedMoney(trade.net_pnl * fxRate, currency, intlLocale())}
            </ItemTitle>
            {trade.return_pct != null && (
              <ItemDescription
                className={cn("text-[13px] tabular-nums", pnlColor(trade.return_pct))}
              >
                {trade.return_pct >= 0 ? "+" : ""}
                {trade.return_pct.toFixed(2)}%
              </ItemDescription>
            )}
          </>
        ) : (
          <ItemTitle className="text-[15px] text-text-muted">—</ItemTitle>
        )}
      </ItemContent>
      <ItemActions
        className="self-center"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <TradeRowMenu
          trade={trade}
          actions={{
            onOpenDrawer: onSelectTrade,
            onOpenFullPage,
            onFilterSymbol,
            onDeleted,
          }}
        />
      </ItemActions>
    </Item>
  );
}

function DayTradesDrawer({
  selectedDay,
  onClose,
  dayTrades,
  dayTradesLoading,
  dayTradesError,
  currency,
  fxRate = 1,
  onSelectTrade,
  onOpenFullPage,
  onFilterSymbol,
  onDeleted,
}: {
  selectedDay: string | null;
  onClose: () => void;
  dayTrades: Trade[];
  dayTradesLoading: boolean;
  dayTradesError: boolean;
  currency: string;
  fxRate?: number;
  onSelectTrade: (t: Trade) => void;
  onOpenFullPage: (t: Trade) => void;
  onFilterSymbol?: (symbol: string) => void;
  onDeleted?: (t: Trade) => void;
}) {
  const open = Boolean(selectedDay);
  const title = selectedDay ? `Trades — ${formatDayTitle(selectedDay)}` : "Day trades";

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      modal="trap-focus"
    >
      <DrawerContent className="[--drawer-content-width:min(440px,calc(100vw-2*var(--drawer-inset)))]">
        <DrawerHeader className="px-4 py-3">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerClose
            aria-label="Close"
            className="ml-auto flex cursor-pointer rounded-control border-none bg-transparent p-1 text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
          >
            <X size={18} strokeWidth={1.5} />
          </DrawerClose>
        </DrawerHeader>
        <DrawerBody className="gap-0 p-0">
          {dayTradesLoading ? (
            <Skeleton height="160px" className="m-4" />
          ) : dayTradesError ? (
            <p className="p-4 text-xs text-loss">Failed to load trades.</p>
          ) : dayTrades.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No trades on this day" />
            </div>
          ) : (
            <ItemGroup className="gap-2 p-4">
              {dayTrades.map((trade) => (
                <DayTradeItem
                  key={trade.id}
                  trade={trade}
                  currency={currency}
                  fxRate={fxRate}
                  onSelectTrade={onSelectTrade}
                  onOpenFullPage={onOpenFullPage}
                  onFilterSymbol={onFilterSymbol}
                  onDeleted={onDeleted}
                />
              ))}
            </ItemGroup>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
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
  monthSummary,
  accounts,
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
  onOpenFullPage,
  onFilterSymbol,
  onDeleted,
}: CalendarViewProps) {
  usePrivacyMode();
  const [monthSummaryOpen, setMonthSummaryOpen] = useState(false);
  const [yearSummaryOpen, setYearSummaryOpen] = useState(false);
  const { currency: displayCurrency, rate } = useMoneyFx(currency);
  const fxRate = rate ?? 1;
  const money = (v: number) => v * fxRate;
  const grid = monthGrid(year, month, dailyPnl);
  const weeks = weekSummaries(grid.weeks, records);
  const today = todayString();

  const startingList = selectedAccountId
    ? accounts.filter((a) => a.id === selectedAccountId)
    : accounts;
  const starting = startingList.reduce((s, a) => s + a.starting_balance, 0);
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
      <Page fill className="min-h-[calc(100dvh-52px)]">
        <Card fill flush className="min-h-0">
          <div className="relative grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2 px-4 pt-3 pb-5">
            <div className="justify-self-start">
              <div className="md:hidden">
                <SegmentedControl
                  ariaLabel="Calendar mode"
                  options={[...VIEW_OPTS]}
                  value={mode}
                  onChange={(v) => changeMode(v as CalendarMode)}
                  size="xs"
                />
              </div>
              <div className="hidden md:block">
                <SegmentedControl
                  ariaLabel="Calendar mode"
                  options={[...VIEW_OPTS]}
                  value={mode}
                  onChange={(v) => changeMode(v as CalendarMode)}
                />
              </div>
            </div>

            <div className="justify-self-center">
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
                <div className="flex items-center gap-1 md:gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onPrevYear}
                    aria-label="Previous year"
                    className="pointer-coarse:size-11"
                  >
                    <ChevronLeft size={14} strokeWidth={1.5} />
                  </Button>
                  <span className="min-w-[4.5rem] text-center text-[13px] font-semibold tabular-nums tracking-[-0.02em] text-text md:text-[15px]">
                    {year}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onNextYear}
                    disabled={!canGoNextYear}
                    aria-label="Next year"
                    className="pointer-coarse:size-11"
                  >
                    <ChevronRight size={14} strokeWidth={1.5} />
                  </Button>
                </div>
              )}
            </div>

            <div className="justify-self-end">
              {mode === "month" ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setMonthSummaryOpen(true)}
                  className={cn(
                    "shrink-0 font-semibold tabular-nums",
                    monthPnl >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {fmtSignedMoneyCompact(money(monthPnl), displayCurrency, intlLocale())}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setYearSummaryOpen(true)}
                  className={cn(
                    "shrink-0 font-semibold tabular-nums",
                    yearPnlTotal >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {fmtSignedMoneyCompact(money(yearPnlTotal), displayCurrency, intlLocale())}
                </Button>
              )}
            </div>
          </div>

          <div
            key={`${mode}-${modeAnimKey.current}`}
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              "animate-[calendar-mode-in_250ms_var(--ease-out)_both]",
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
              <Skeleton height="100%" className="m-4 min-h-[320px] flex-1" />
            ) : dailyError ? (
              <p className="p-4 text-xs text-loss">Failed to load daily P&L.</p>
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
                        "px-1 py-1 text-center text-[11px] font-medium text-text-muted",
                        WEEKEND_DOW.has(di) && "hidden md:block",
                      )}
                    >
                      {d}
                    </div>
                  ))}
                  <div className="px-1 py-1 text-center text-[11px] font-medium text-text-muted">
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
                                    ? "inline-flex size-5 items-center justify-center rounded-full bg-accent font-semibold text-bg"
                                    : "text-text-muted",
                                )}
                              >
                                {dayNum}
                              </span>
                              {hasPnl ? (
                                <span className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5">
                                  <span
                                    className="text-[11px] font-semibold tabular-nums md:text-base lg:text-lg"
                                    style={{ color: dayColor(cell.pnl!) }}
                                  >
                                    {fmtSignedMoneyCompact(
                                      money(cell.pnl!),
                                      displayCurrency,
                                      intlLocale(),
                                    )}
                                  </span>
                                  {trades > 0 && (
                                    <span className="text-[10px] tabular-nums text-text-muted">
                                      {trades} {trades === 1 ? "trade" : "trades"}
                                    </span>
                                  )}
                                  {winRate && (
                                    <span className="text-[10px] tabular-nums text-text-muted">
                                      <WinLossRecord
                                        wins={rec!.wins}
                                        losses={rec!.losses}
                                        className="opacity-90"
                                      />
                                      <span className="text-text-dim"> · {winRate}</span>
                                    </span>
                                  )}
                                </span>
                              ) : null}
                            </>
                          );
                          const dayClass = cn(
                            "relative flex h-full min-h-0 w-full flex-col justify-start rounded-control px-1 py-1 text-left transition-colors duration-150 md:px-2 md:py-1.5",
                            hasPnl ? "cursor-pointer" : "cursor-default",
                            isToday && !hasPnl && "bg-tint-signal",
                            isSelected && "ring-1 ring-accent ring-inset",
                            WEEKEND_DOW.has(di) && "hidden md:flex",
                          );
                          const dayStyle = {
                            background: hasPnl
                              ? pnlBgTint(cell.pnl!)
                              : isToday
                                ? undefined
                                : "var(--color-surface-raised)",
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
                            "relative flex h-full min-h-0 w-full flex-col rounded-control px-1.5 py-1 md:px-2.5 md:py-1.5",
                            !ws.hasData && "bg-bg-inset",
                          )}
                          style={ws.hasData ? { background: pnlBgTint(ws.pnl) } : undefined}
                        >
                          {ws.weekNumber != null && (
                            <span className="absolute top-1 right-1.5 z-[1] text-[10px] font-medium text-text-muted md:top-1.5 md:right-2.5 md:text-[11px]">
                              Week {ws.weekNumber}
                            </span>
                          )}
                          {ws.hasData ? (
                            <span className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-0.5 md:gap-1.5">
                              <span
                                className="text-[11px] font-semibold tabular-nums md:text-base lg:text-lg"
                                style={{ color: dayColor(ws.pnl) }}
                              >
                                {fmtSignedMoneyCompact(
                                  money(ws.pnl),
                                  displayCurrency,
                                  intlLocale(),
                                )}
                              </span>
                              {ws.wins + ws.losses > 0 ? (
                                <span className="text-[10px] tabular-nums">
                                  <WinLossRecord wins={ws.wins} losses={ws.losses} />
                                </span>
                              ) : null}
                              <span className="text-[10px] tabular-nums text-text-muted">
                                {ws.daysWithTrades} {ws.daysWithTrades === 1 ? "day" : "days"}
                              </span>
                            </span>
                          ) : (
                            <span className="flex h-full items-center justify-center text-xs text-text-dim">
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
        onOpenFullPage={onOpenFullPage}
        onFilterSymbol={onFilterSymbol}
        onDeleted={onDeleted}
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
        className="relative overflow-hidden rounded-control px-4 py-7 text-center"
        style={{ background: pnlBgTint(pnl, { minOpacity: 0.07, maxOpacity: 0.2, scale: 400 }) }}
      >
        <p className="m-0 text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Net P&L
        </p>
        <p
          className={cn(
            "m-0 mt-2.5",
            heroPnlClass(pnl),
            pnl > 0 && "hero-glow-profit",
            pnl < 0 && "hero-glow-loss",
          )}
        >
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
    <div className="flex min-w-0 flex-col gap-1.5 rounded-control bg-bg px-3 py-3">
      <p className="m-0 truncate text-[10px] font-medium uppercase tracking-[0.1em] text-text-muted">
        {label}
      </p>
      <p className="m-0 text-[18px] font-semibold tracking-[-0.02em] tabular-nums text-text">
        {value}
      </p>
    </div>
  );
}
