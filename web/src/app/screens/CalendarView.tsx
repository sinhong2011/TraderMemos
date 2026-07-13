import { CalendarDays } from "lucide-react";
import { Card } from "../../components/Card";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { MonthPicker } from "../../components/MonthPicker";
import { Page } from "../../components/Page";
import { Skeleton } from "../../components/Skeleton";
import { pnlColor } from "../../components/theme-tokens";
import { tradeColumns } from "../../components/tradeColumns";
import type { Account, Summary, Trade } from "../../lib/api/types";
import { type DayRecord, monthGrid, weekSummaries } from "../../lib/calendar";
import { fmtPct, fmtRecord, fmtSignedMoney } from "../../lib/format";
import { intlLocale } from "../../lib/locale";

const DOW_HEADERS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export interface CalendarViewProps {
  dailyPnl: Record<string, number>;
  dailyLoading: boolean;
  dailyError: boolean;
  records: Record<string, DayRecord>;
  monthSummary: Summary | undefined;
  accounts: Account[];
  selectedAccountId: string | undefined;
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onJumpToMonth: (year: number, month: number) => void;
  canGoNext: boolean;
  selectedDay: string | null;
  onSelectDay: (date: string | null) => void;
  dayTrades: Trade[];
  dayTradesLoading: boolean;
  dayTradesError: boolean;
  currency: string;
  onSelectTrade: (t: Trade) => void;
}

/** Scale opacity 0.10..0.40 by magnitude (capped at $2000). */
function bgOpacity(pnl: number): number {
  const norm = Math.min(Math.abs(pnl) / 2000, 1);
  return 0.1 + norm * 0.3;
}

function dayBg(pnl: number): string {
  const op = bgOpacity(pnl).toFixed(2);
  return pnl >= 0 ? `rgba(82, 202, 150, ${op})` : `rgba(235, 75, 104, ${op})`;
}

function dayColor(pnl: number): string {
  return pnl >= 0 ? "var(--color-pos)" : "var(--color-neg)";
}

function todayString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function HeaderStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </span>
      <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--color-text)" }}>
        {children}
      </span>
    </div>
  );
}

export function CalendarView({
  dailyPnl,
  dailyLoading,
  dailyError,
  records,
  monthSummary,
  accounts,
  selectedAccountId,
  year,
  month,
  onPrevMonth,
  onNextMonth,
  onToday,
  onJumpToMonth,
  canGoNext,
  selectedDay,
  onSelectDay,
  dayTrades,
  dayTradesLoading,
  dayTradesError,
  currency,
  onSelectTrade,
}: CalendarViewProps) {
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

  return (
    <Page>
      <Card flush>
        {/* Header: month nav + stats */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <MonthPicker
            year={year}
            month={month}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
            onToday={onToday}
            onJumpToMonth={onJumpToMonth}
            canGoNext={canGoNext}
          />

          <div className="ml-auto flex flex-wrap items-center gap-5">
            {monthSummary && (
              <>
                <HeaderStat label="Trades">{monthSummary.total_trades}</HeaderStat>
                <HeaderStat label="Win rate">
                  {fmtPct(monthSummary.win_rate, intlLocale())}
                </HeaderStat>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Record
                  </span>
                  <span
                    className="text-xs font-semibold tabular-nums"
                    style={{ color: "var(--color-pos)" }}
                  >
                    {monthSummary.wins}W
                  </span>
                  <span
                    className="text-xs font-semibold tabular-nums"
                    style={{ color: "var(--color-neg)" }}
                  >
                    {monthSummary.losses}L
                  </span>
                </div>
                <HeaderStat label="Profit factor">
                  {monthSummary.profit_factor === 0 ? "-" : monthSummary.profit_factor.toFixed(2)}
                </HeaderStat>
              </>
            )}
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Month P&L:
              </span>
              <span className={`text-xs font-bold tabular-nums ${pnlColor(monthPnl)}`}>
                {fmtSignedMoney(monthPnl, currency, intlLocale())}
                {monthPct != null && ` (${monthPct.toFixed(1)}%)`}
              </span>
            </div>
          </div>
        </div>

        {/* Grid */}
        {dailyLoading ? (
          <Skeleton height="420px" className="m-4" />
        ) : dailyError ? (
          <p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
            Failed to load daily P&L.
          </p>
        ) : (
          <div className="p-4">
            {/* DOW header row + WEEK header */}
            <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: "repeat(7, 1fr) 96px" }}>
              {DOW_HEADERS.map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-semibold tracking-wide py-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {d}
                </div>
              ))}
              <div
                className="text-center text-[10px] font-semibold tracking-wide py-1"
                style={{ color: "var(--color-text-muted)" }}
              >
                WEEK
              </div>
            </div>

            {/* Week rows */}
            {grid.weeks.map((week, wi) => {
              const ws = weeks[wi];
              // Hide fully-empty trailing rows (6-row fixed grid)
              if (week.every((c) => c == null)) return null;
              return (
                <div
                  key={wi}
                  className="grid gap-1 mb-1"
                  style={{ gridTemplateColumns: "repeat(7, 1fr) 96px" }}
                >
                  {week.map((cell, di) => {
                    if (!cell) {
                      return <div key={di} style={{ minHeight: 84 }} />;
                    }
                    const dayNum = Number(cell.date.slice(8, 10));
                    const hasPnl = cell.pnl != null;
                    const rec = records[cell.date];
                    const isSelected = selectedDay === cell.date;
                    const isToday = cell.date === today;
                    return (
                      <button
                        key={di}
                        type="button"
                        onClick={() =>
                          hasPnl ? onSelectDay(isSelected ? null : cell.date) : undefined
                        }
                        aria-label={
                          hasPnl
                            ? `${cell.date} ${fmtSignedMoney(cell.pnl!, currency, intlLocale())}`
                            : cell.date
                        }
                        className="flex flex-col rounded-lg text-left"
                        style={{
                          minHeight: 84,
                          padding: "6px 8px",
                          background: hasPnl ? dayBg(cell.pnl!) : "var(--color-surface-raised)",
                          border: isSelected
                            ? "1px solid var(--color-accent)"
                            : "1px solid transparent",
                          cursor: hasPnl ? "pointer" : "default",
                          position: "relative",
                          transition: "border-color var(--duration-fast)",
                        }}
                      >
                        <span
                          className="text-[11px] font-medium"
                          style={{
                            color: hasPnl ? dayColor(cell.pnl!) : "var(--color-text-muted)",
                          }}
                        >
                          {dayNum}
                        </span>
                        {isToday && (
                          <span
                            data-testid="today-dot"
                            style={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              background: "var(--color-accent)",
                            }}
                          />
                        )}
                        {hasPnl && (
                          <span
                            className="flex flex-col items-center justify-center flex-1 gap-0.5"
                            style={{ color: dayColor(cell.pnl!) }}
                          >
                            <span className="text-sm font-bold tabular-nums">
                              {fmtSignedMoney(cell.pnl!, currency, intlLocale())}
                            </span>
                            {rec && (
                              <span className="text-[10px] tabular-nums opacity-90">
                                {fmtRecord(rec.wins, rec.losses)}
                              </span>
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* WEEK summary cell */}
                  <div
                    className="flex flex-col items-center justify-center rounded-lg gap-0.5"
                    style={{
                      minHeight: 84,
                      background: ws.hasData ? dayBg(ws.pnl) : "var(--color-surface-raised)",
                      color: ws.hasData ? dayColor(ws.pnl) : "var(--color-text-muted)",
                    }}
                  >
                    {ws.hasData ? (
                      <>
                        <span className="text-sm font-bold tabular-nums">
                          {fmtSignedMoney(ws.pnl, currency, intlLocale())}
                        </span>
                        <span className="text-[10px] tabular-nums opacity-90">
                          {fmtRecord(ws.wins, ws.losses)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs">-</span>
                    )}
                  </div>
                </div>
              );
            })}

            {!hasAnyPnl && (
              <div className="flex items-center justify-center py-6">
                <EmptyState
                  title="No trades this month"
                  hint="Navigate to a month with trades to see the P&L heatmap."
                  icon={<CalendarDays size={32} strokeWidth={1.5} />}
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {selectedDay ? (
        <Card
          title={`Trades - ${new Date(`${selectedDay}T00:00:00`).toLocaleDateString(intlLocale(), {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}`}
          action={
            <button
              type="button"
              onClick={() => onSelectDay(null)}
              className="cursor-pointer text-[11px] text-text-muted transition-colors hover:text-text"
            >
              Close
            </button>
          }
          flush
        >
          {dayTradesLoading ? (
            <Skeleton height="120px" className="m-4" />
          ) : dayTradesError ? (
            <p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
              Failed to load trades.
            </p>
          ) : dayTrades.length === 0 ? (
            <EmptyState title="No trades on this day" />
          ) : (
            <div style={{ maxHeight: 280 }}>
              <DataTable
                columns={tradeColumns(currency, onSelectTrade)}
                data={dayTrades}
                onRowClick={onSelectTrade}
              />
            </div>
          )}
        </Card>
      ) : null}
    </Page>
  );
}
