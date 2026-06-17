import type { ColumnDef } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { Skeleton } from "../../components/Skeleton";
import { pnlColor } from "../../components/theme-tokens";
import { monthGrid } from "../../lib/calendar";
import { fmtSignedMoney } from "../../lib/format";
import type { Filters, Trade } from "../../lib/api/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CalendarViewProps {
  // Daily P&L map {"YYYY-MM-DD": number}
  dailyPnl: Record<string, number>;
  dailyLoading: boolean;
  dailyError: boolean;

  // Controlled month state
  year: number;
  month: number; // 1-based
  onPrevMonth: () => void;
  onNextMonth: () => void;

  // Selected day trades
  selectedDay: string | null;
  onSelectDay: (date: string | null) => void;
  dayTrades: Trade[];
  dayTradesLoading: boolean;
  dayTradesError: boolean;

  // Shared filters (for currency)
  filters: Filters;
  currency: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOCALE = "en-US";
const DOW_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Scale opacity 0.08..0.35 by magnitude (capped at $2000). */
function bgOpacity(pnl: number): number {
  const abs = Math.abs(pnl);
  const norm = Math.min(abs / 2000, 1);
  return 0.08 + norm * 0.27;
}

function dayBg(pnl: number): string {
  const op = bgOpacity(pnl);
  return pnl >= 0
    ? `rgba(52,211,153,${op.toFixed(2)})`  // emerald
    : `rgba(248,113,113,${op.toFixed(2)})`; // red
}

function dayColor(pnl: number): string {
  return pnl >= 0 ? "var(--color-pos)" : "var(--color-neg)";
}

// ---------------------------------------------------------------------------
// Day trades columns
// ---------------------------------------------------------------------------

function dayTradesColumns(currency: string): ColumnDef<Trade>[] {
  return [
    {
      accessorKey: "symbol",
      header: "Symbol",
      cell: (info) => (
        <span style={{ color: "var(--color-text)" }}>
          {info.getValue<string>()}
        </span>
      ),
    },
    {
      accessorKey: "direction",
      header: "Dir",
      cell: (info) => (
        <span
          style={{
            color:
              info.getValue<string>() === "long"
                ? "var(--color-pos)"
                : "var(--color-neg)",
          }}
        >
          {info.getValue<string>().toUpperCase()}
        </span>
      ),
    },
    {
      accessorKey: "instrument_type",
      header: "Type",
      cell: (info) => (
        <span style={{ color: "var(--color-text-muted)" }}>
          {info.getValue<string>()}
        </span>
      ),
    },
    {
      accessorKey: "qty_opened",
      header: "Qty",
      cell: (info) => (
        <span className="tabular-nums" style={{ color: "var(--color-text-muted)" }}>
          {info.getValue<number>()}
        </span>
      ),
    },
    {
      accessorKey: "net_pnl",
      header: "Net P&L",
      cell: (info) => {
        const v = info.getValue<number | null>();
        if (v == null) return <span style={{ color: "var(--color-text-muted)" }}>-</span>;
        return (
          <span className={`tabular-nums ${pnlColor(v)}`}>
            {fmtSignedMoney(v, currency, LOCALE)}
          </span>
        );
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MonthNav({
  year,
  month,
  onPrev,
  onNext,
}: {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const label = new Date(year, month - 1, 1).toLocaleString(LOCALE, {
    month: "long",
    year: "numeric",
  });
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        aria-label="Previous month"
        className="flex items-center justify-center rounded"
        style={{
          width: 28,
          height: 28,
          color: "var(--color-text-muted)",
          background: "transparent",
          border: "1px solid var(--color-border)",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--color-text)";
          (e.currentTarget as HTMLElement).style.background = "var(--color-surface-hover)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
      </button>
      <span
        className="text-sm font-semibold tabular-nums"
        style={{ color: "var(--color-text)", minWidth: 140, textAlign: "center" }}
      >
        {label}
      </span>
      <button
        onClick={onNext}
        aria-label="Next month"
        className="flex items-center justify-center rounded"
        style={{
          width: 28,
          height: 28,
          color: "var(--color-text-muted)",
          background: "transparent",
          border: "1px solid var(--color-border)",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--color-text)";
          (e.currentTarget as HTMLElement).style.background = "var(--color-surface-hover)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <ChevronRight size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function CalendarView({
  dailyPnl,
  dailyLoading,
  dailyError,
  year,
  month,
  onPrevMonth,
  onNextMonth,
  selectedDay,
  onSelectDay,
  dayTrades,
  dayTradesLoading,
  dayTradesError,
  currency,
}: CalendarViewProps) {
  const grid = monthGrid(year, month, dailyPnl);

  // Per-week totals
  const weekTotals = grid.weeks.map((week) =>
    week.reduce((sum, cell) => sum + (cell?.pnl ?? 0), 0),
  );

  const hasAnyPnl = Object.keys(dailyPnl).some((key) => {
    const [y, m] = key.split("-").map(Number);
    return y === year && m === month;
  });

  // Header nav for the panel
  const panelRight = (
    <MonthNav
      year={year}
      month={month}
      onPrev={onPrevMonth}
      onNext={onNextMonth}
    />
  );

  const renderGrid = () => {
    if (dailyLoading) {
      return <Skeleton height="320px" className="m-4" />;
    }
    if (dailyError) {
      return (
        <p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
          Failed to load daily P&L.
        </p>
      );
    }
    if (!hasAnyPnl) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[280px]">
          <EmptyState
            title="No trades this month"
            hint="Navigate to a month with trades to see the P&L heatmap."
            icon={<CalendarDays size={32} strokeWidth={1.5} />}
          />
        </div>
      );
    }

    return (
      <div className="p-4">
        {/* DOW header row + week-total spacer */}
        <div className="grid grid-cols-[repeat(7,1fr)_auto] gap-px mb-1">
          {DOW_HEADERS.map((d) => (
            <div
              key={d}
              className="text-center text-[11px] font-medium uppercase py-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              {d}
            </div>
          ))}
          <div
            className="text-right text-[11px] font-medium uppercase px-2 py-1"
            style={{ color: "var(--color-text-muted)", minWidth: 72 }}
          >
            Week
          </div>
        </div>

        {/* Week rows */}
        {grid.weeks.map((week, wi) => {
          const wTotal = weekTotals[wi];
          const weekHasPnl = week.some((c) => c?.pnl != null);
          return (
            <div
              key={wi}
              className="grid grid-cols-[repeat(7,1fr)_auto] gap-px mb-px"
            >
              {week.map((cell, di) => {
                if (!cell) {
                  return (
                    <div
                      key={di}
                      className="aspect-square rounded"
                      style={{ background: "transparent" }}
                    />
                  );
                }
                const dayNum = Number(cell.date.slice(8, 10));
                const hasPnl = cell.pnl != null;
                const isSelected = selectedDay === cell.date;

                return (
                  <button
                    key={di}
                    onClick={() =>
                      hasPnl
                        ? onSelectDay(isSelected ? null : cell.date)
                        : undefined
                    }
                    aria-label={
                      hasPnl
                        ? `${cell.date} ${fmtSignedMoney(cell.pnl!, currency, LOCALE)}`
                        : cell.date
                    }
                    className="flex flex-col items-center justify-center aspect-square rounded text-[11px] leading-tight"
                    style={{
                      background: hasPnl
                        ? dayBg(cell.pnl!)
                        : "var(--color-surface)",
                      color: hasPnl
                        ? dayColor(cell.pnl!)
                        : "var(--color-text-muted)",
                      cursor: hasPnl ? "pointer" : "default",
                      border: isSelected
                        ? "1px solid var(--color-accent)"
                        : "1px solid transparent",
                      transition: "border-color var(--duration-fast)",
                      minHeight: 52,
                      padding: "4px 2px",
                    }}
                  >
                    <span className="font-medium">{dayNum}</span>
                    {hasPnl && (
                      <span className="tabular-nums text-[10px] mt-0.5 leading-none">
                        {fmtSignedMoney(cell.pnl!, currency, LOCALE)}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Week total */}
              <div
                className="flex items-center justify-end px-2 text-[11px] tabular-nums font-medium"
                style={{
                  color: weekHasPnl
                    ? wTotal >= 0
                      ? "var(--color-pos)"
                      : "var(--color-neg)"
                    : "var(--color-text-muted)",
                  minWidth: 72,
                }}
              >
                {weekHasPnl ? fmtSignedMoney(wTotal, currency, LOCALE) : "-"}
              </div>
            </div>
          );
        })}

        {/* Month total */}
        <div
          className="mt-3 pt-3 flex items-center justify-between text-xs tabular-nums"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <span style={{ color: "var(--color-text-muted)" }}>Month total</span>
          <span
            className="font-semibold"
            style={{
              color:
                grid.monthTotal > 0
                  ? "var(--color-pos)"
                  : grid.monthTotal < 0
                    ? "var(--color-neg)"
                    : "var(--color-text-muted)",
            }}
          >
            {grid.monthTotal !== 0
              ? fmtSignedMoney(grid.monthTotal, currency, LOCALE)
              : "-"}
          </span>
        </div>
      </div>
    );
  };

  const renderDayPanel = () => {
    if (!selectedDay) return null;

    const dayLabel = new Date(selectedDay + "T00:00:00").toLocaleDateString(
      LOCALE,
      { weekday: "short", month: "short", day: "numeric", year: "numeric" },
    );

    return (
      <Panel
        title={`Trades - ${dayLabel}`}
        right={
          <button
            onClick={() => onSelectDay(null)}
            className="text-[11px]"
            style={{
              color: "var(--color-text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        }
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
              columns={dayTradesColumns(currency)}
              data={dayTrades}
            />
          </div>
        )}
      </Panel>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title="P&L Calendar" right={panelRight}>
        {renderGrid()}
      </Panel>

      {renderDayPanel()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stateful month wrapper (used by the route)
// ---------------------------------------------------------------------------

export interface CalendarViewStatefulProps {
  dailyPnl: Record<string, number>;
  dailyLoading: boolean;
  dailyError: boolean;
  selectedDay: string | null;
  onSelectDay: (date: string | null) => void;
  dayTrades: Trade[];
  dayTradesLoading: boolean;
  dayTradesError: boolean;
  filters: Filters;
  currency: string;
  // Controlled from route so tests can also drive it:
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

// Re-export with same name so route just uses CalendarView; the stateful
// wrapper is the CalendarView itself (month nav is controlled externally).
