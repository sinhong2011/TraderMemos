import { Flame } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Card } from "./Card";
import { CHART_TIME_ZONE } from "./charts/chartTime";
import { EmptyState } from "./EmptyState";
import { useReportsMoney } from "./ReportsDisplayContext";
import { Skeleton } from "./Skeleton";
import { Popover, PopoverContent } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import type { Trade } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtDayShort, fmtPct } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { computePnlHeatmap, HEATMAP_DAY_LABELS, type HeatmapCell } from "@/lib/pnlHeatmap";

export interface ReportsPnlHeatmapProps {
  trades: Trade[];
  loading: boolean;
  error: boolean;
  onSelectTradeId?: (id: string) => void;
}

const DETAIL_TRADE_LIMIT = 8;

function cellBackground(pnl: number, trades: number, maxAbsPnl: number): string | undefined {
  if (trades === 0 || maxAbsPnl <= 0) return undefined;
  const token = pnl >= 0 ? "--color-profit" : "--color-loss";
  const strength = Math.round(15 + 75 * (Math.abs(pnl) / maxAbsPnl));
  return `color-mix(in oklab, var(${token}) ${strength}%, transparent)`;
}

function pnlClass(v: number): string {
  return v > 0 ? "text-profit" : v < 0 ? "text-destructive" : "text-muted-foreground";
}

/** Weekday × entry-hour P&L heatmap over the Reports-filtered trades. */
export function ReportsPnlHeatmap({
  trades,
  loading,
  error,
  onSelectTradeId,
}: ReportsPnlHeatmapProps) {
  usePrivacyMode();
  const money = useReportsMoney();
  const locale = intlLocale();
  const gross = money.pnlMode === "gross";
  const heatmap = useMemo(
    // Mirrors useReportsMoney().tradePnl — inlined so the memo can key on the
    // mode instead of a per-render closure.
    () =>
      computePnlHeatmap(
        trades,
        CHART_TIME_ZONE,
        gross ? (t) => t.gross_pnl ?? t.net_pnl ?? 0 : undefined,
      ),
    [trades, gross],
  );
  const [selected, setSelected] = useState<{ day: number; hour: number } | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const selectedCell: HeatmapCell | null = selected
    ? heatmap.grid[selected.day][selected.hour]
    : null;

  const hours: number[] = [];
  for (let h = heatmap.hourStart; h <= heatmap.hourEnd; h++) hours.push(h);

  let body: React.ReactNode;
  if (loading) {
    body = <Skeleton height="240px" />;
  } else if (error) {
    body = <p className="text-xs text-destructive">Failed to load trades.</p>;
  } else if (heatmap.total === 0) {
    body = (
      <EmptyState
        className="py-8"
        title="No closed trades yet"
        hint="Once trades are logged, this shows when your edge shows up — by weekday and entry hour."
        icon={<Flame aria-hidden />}
      />
    );
  } else {
    body = (
      <>
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[560px] gap-1"
            style={{ gridTemplateColumns: `44px repeat(${hours.length}, minmax(0, 1fr))` }}
          >
            <div />
            {hours.map((h) => (
              <div
                key={`h${h}`}
                className="text-center text-[10px] tabular-nums text-muted-foreground"
              >
                {h}
              </div>
            ))}
            {heatmap.days.map((d) => (
              <Fragment key={`d${d}`}>
                <div className="flex items-center text-[11px] text-muted-foreground">
                  {HEATMAP_DAY_LABELS[d]}
                </div>
                {hours.map((h) => {
                  const cell = heatmap.grid[d][h];
                  const traded = cell.trades > 0;
                  const label = traded
                    ? `${HEATMAP_DAY_LABELS[d]} ${h}:00 — ${money.format(cell.pnl)} · ${cell.trades} trade${cell.trades === 1 ? "" : "s"}`
                    : `${HEATMAP_DAY_LABELS[d]} ${h}:00 — no trades`;
                  return (
                    <Tooltip key={`c${d}-${h}`}>
                      <TooltipTrigger
                        aria-label={label}
                        className={cn(
                          "h-9 rounded-sm bg-muted/40 outline-none transition-shadow duration-150",
                          traded
                            ? "cursor-pointer hover:inset-ring-2 hover:inset-ring-foreground/30 focus-visible:inset-ring-2 focus-visible:inset-ring-ring"
                            : "cursor-default hover:inset-ring-1 hover:inset-ring-foreground/15",
                        )}
                        style={{
                          background: cellBackground(cell.pnl, cell.trades, heatmap.maxAbsPnl),
                        }}
                        onClick={
                          traded
                            ? (e) => {
                                setAnchor(e.currentTarget);
                                setSelected({ day: d, hour: h });
                              }
                            : undefined
                        }
                      />
                      <TooltipContent
                        side="top"
                        className="flex-col items-start gap-0.5 px-2.5 py-1.5"
                      >
                        <span className="font-medium text-foreground">
                          {HEATMAP_DAY_LABELS[d]} {h}:00
                        </span>
                        {traded ? (
                          <span className="text-[11px]">
                            <span className={cn("tabular-nums font-medium", pnlClass(cell.pnl))}>
                              {money.format(cell.pnl)}
                            </span>
                            <span className="text-muted-foreground">
                              {" "}
                              · {cell.trades} trade{cell.trades === 1 ? "" : "s"}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">No trades</span>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground">
          P&L by entry weekday and hour, on the market clock (Eastern). Deeper color means a bigger
          total; green is profit, red is loss. Click a cell for the trades behind it.
        </p>
        <Popover
          open={selected != null}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          {selected && selectedCell ? (
            <CellDetails
              day={selected.day}
              hour={selected.hour}
              cell={selectedCell}
              anchor={anchor}
              locale={locale}
              onSelectTradeId={onSelectTradeId}
            />
          ) : null}
        </Popover>
      </>
    );
  }

  return <Card title="P&L heatmap">{body}</Card>;
}

function CellDetails({
  day,
  hour,
  cell,
  anchor,
  locale,
  onSelectTradeId,
}: {
  day: number;
  hour: number;
  cell: HeatmapCell;
  anchor: HTMLElement | null;
  locale: string;
  onSelectTradeId?: (id: string) => void;
}) {
  const money = useReportsMoney();
  const wins = cell.items.filter((t) => money.tradePnl(t) > 0).length;
  const losses = cell.items.filter((t) => money.tradePnl(t) < 0).length;
  const recentFirst = [...cell.items].sort((a, b) => b.opened_at.localeCompare(a.opened_at));
  const shown = recentFirst.slice(0, DETAIL_TRADE_LIMIT);
  const hidden = recentFirst.length - shown.length;

  return (
    <PopoverContent anchor={anchor} side="bottom" className="w-72">
      <div className="flex flex-col gap-2">
        <header className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {HEATMAP_DAY_LABELS[day]} · {hour}:00–{(hour + 1) % 24}:00
          </h3>
          <span className="text-[11px] text-muted-foreground">ET</span>
        </header>
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("text-lg font-semibold tabular-nums", pnlClass(cell.pnl))}>
            {money.format(cell.pnl)}
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {wins}W · {losses}L · {fmtPct(cell.trades > 0 ? wins / cell.trades : 0, locale)} win
          </span>
        </div>
        <ul className="-mx-2 flex flex-col">
          {shown.map((t) => {
            const pnl = money.tradePnl(t);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-accent"
                  onClick={() => onSelectTradeId?.(t.id)}
                >
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                    {t.symbol}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {fmtDayShort(t.opened_at, locale)}
                  </span>
                  <span className={cn("shrink-0 text-xs tabular-nums", pnlClass(pnl))}>
                    {money.format(pnl)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {hidden > 0 ? (
          <p className="text-[11px] text-muted-foreground">+{hidden} more in this hour</p>
        ) : null}
      </div>
    </PopoverContent>
  );
}
