import { ArrowRight } from "lucide-react";
import { type DayRecord, monthGrid } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { fmtSignedMoneyCompact } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { CalendarDayHoverCard } from "./CalendarDayHoverCard";
import { pnlBgTint, pnlColor } from "./theme-tokens";
import { Button } from "./ui/button";
import { usePrivacyMode } from "@/lib/displayPrefs";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export interface DashboardMiniCalendarProps {
  year: number;
  month: number;
  dailyPnl: Record<string, number>;
  dayRecords?: Record<string, DayRecord>;
  currency: string;
  fxRate?: number;
  loading?: boolean;
  error?: boolean;
  onOpenCalendar: () => void;
}

function monthLabel(year: number, month: number, locale: string): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function DashboardMiniCalendar({
  year,
  month,
  dailyPnl,
  dayRecords = {},
  currency,
  fxRate = 1,
  loading,
  error,
  onOpenCalendar,
}: DashboardMiniCalendarProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const grid = monthGrid(year, month, dailyPnl);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <section className="flex h-full flex-col rounded-lg bg-card">
      <header className="flex items-start justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-[10px] font-semibold tracking-wide text-chart-3">Month</h2>
          <p className="mt-1 text-[13px] font-medium text-foreground">
            {monthLabel(year, month, locale)}
          </p>
        </div>
        <Button
          type="button"
          variant="link"
          onClick={onOpenCalendar}
          className="h-auto gap-1 text-[11px] font-medium"
        >
          Full calendar
          <ArrowRight size={12} strokeWidth={2} aria-hidden />
        </Button>
      </header>

      <div className="flex flex-1 flex-col px-3 pb-3">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-[12px] text-muted-foreground">
            Loading…
          </div>
        ) : error ? (
          <p className="px-1 text-xs text-destructive">Failed to load daily P&L.</p>
        ) : (
          <>
            <div className="mb-1 grid grid-cols-7 gap-0.5">
              {DOW.map((d, i) => (
                <div
                  key={`${d}-${i}`}
                  className="py-0.5 text-center text-[9px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid flex-1 grid-cols-7 gap-0.5">
              {grid.weeks.flat().map((cell, i) => {
                if (!cell) {
                  return <div key={`empty-${i}`} className="min-h-9 rounded-md" />;
                }
                const hasPnl = cell.pnl != null;
                const displayPnl = hasPnl ? cell.pnl! * fxRate : null;
                const isToday = cell.date === today;
                const dayNum = Number(cell.date.slice(8, 10));
                const cellClass = cn(
                  "flex min-h-9 w-full flex-col items-center justify-center rounded-md px-0.5 py-1",
                  isToday && !hasPnl && "bg-chart-3/10",
                  hasPnl && "cursor-default",
                );
                const cellStyle =
                  displayPnl != null ? { background: pnlBgTint(displayPnl) } : undefined;
                const dayBody = (
                  <>
                    <span
                      className={cn(
                        "text-[10px] tabular-nums",
                        isToday ? "font-semibold text-chart-3" : "text-muted-foreground",
                      )}
                    >
                      {dayNum}
                    </span>
                    {displayPnl != null ? (
                      <span
                        className={cn(
                          "text-[9px] font-medium leading-tight tabular-nums",
                          pnlColor(displayPnl),
                        )}
                      >
                        {fmtSignedMoneyCompact(displayPnl, currency, locale)}
                      </span>
                    ) : null}
                  </>
                );

                if (!hasPnl) {
                  return (
                    <div
                      key={cell.date}
                      className={cellClass}
                      style={cellStyle}
                      aria-current={isToday ? "date" : undefined}
                    >
                      {dayBody}
                    </div>
                  );
                }

                return (
                  <CalendarDayHoverCard
                    key={cell.date}
                    date={cell.date}
                    pnl={cell.pnl!}
                    record={dayRecords[cell.date]}
                    currency={currency}
                    fxRate={fxRate}
                    ariaCurrent={isToday ? "date" : undefined}
                    className={cellClass}
                    style={cellStyle}
                  >
                    {dayBody}
                  </CalendarDayHoverCard>
                );
              })}
            </div>
            <p className="mt-2 text-center text-[11px] tabular-nums text-muted-foreground">
              Total{" "}
              <span className={cn("font-medium", pnlColor(grid.monthTotal * fxRate))}>
                {fmtSignedMoneyCompact(grid.monthTotal * fxRate, currency, locale)}
              </span>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
