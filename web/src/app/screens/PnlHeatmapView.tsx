import { Flame } from "lucide-react";
import { Fragment } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Page } from "@/components/Page";
import { Skeleton } from "@/components/Skeleton";
import { fmtSignedMoney } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { HEATMAP_DAY_LABELS, type PnlHeatmap } from "@/lib/pnlHeatmap";

export interface PnlHeatmapViewProps {
  heatmap: PnlHeatmap;
  loading: boolean;
  error: boolean;
  currency: string;
  fxRate: number;
}

function cellBackground(pnl: number, trades: number, maxAbsPnl: number): string | undefined {
  if (trades === 0 || maxAbsPnl <= 0) return undefined;
  const token = pnl >= 0 ? "--color-profit" : "--color-loss";
  const strength = Math.round(15 + 75 * (Math.abs(pnl) / maxAbsPnl));
  return `color-mix(in oklab, var(${token}) ${strength}%, transparent)`;
}

/** Personal weekday × entry-hour net P&L heatmap (market time). */
export function PnlHeatmapView({ heatmap, loading, error, currency, fxRate }: PnlHeatmapViewProps) {
  const locale = intlLocale();
  const money = (v: number) => fmtSignedMoney(v * fxRate, currency, locale);

  const header = (
    <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
      <h1 className="text-[20px] font-bold tracking-[-0.02em] text-foreground">P&L heatmap</h1>
    </div>
  );

  if (loading) {
    return (
      <Page>
        {header}
        <div className="mx-auto w-full max-w-4xl">
          <Skeleton height="240px" />
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        {header}
        <p className="mx-auto w-full max-w-4xl p-4 text-xs text-destructive">
          Failed to load trades.
        </p>
      </Page>
    );
  }

  if (heatmap.total === 0) {
    return (
      <Page fill>
        {header}
        <EmptyState
          title="No closed trades yet"
          hint="Once trades are logged, this shows when your edge shows up — by weekday and entry hour."
          icon={<Flame aria-hidden />}
        />
      </Page>
    );
  }

  const hours: number[] = [];
  for (let h = heatmap.hourStart; h <= heatmap.hourEnd; h++) hours.push(h);

  return (
    <Page>
      {header}
      <div className="mx-auto w-full max-w-4xl">
        <section className="rounded-lg bg-card p-5">
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
                    const label =
                      cell.trades > 0
                        ? `${HEATMAP_DAY_LABELS[d]} ${h}:00 — ${money(cell.pnl)} · ${cell.trades} trade${cell.trades === 1 ? "" : "s"}`
                        : `${HEATMAP_DAY_LABELS[d]} ${h}:00 — no trades`;
                    return (
                      <div
                        key={`c${d}-${h}`}
                        title={label}
                        aria-label={label}
                        className="h-9 rounded-sm bg-muted/40"
                        style={{
                          background: cellBackground(cell.pnl, cell.trades, heatmap.maxAbsPnl),
                        }}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            Net P&L by entry weekday and hour, on the market clock (Eastern). Deeper color means a
            bigger total; green is profit, red is loss. Hover a cell for the numbers.
          </p>
        </section>
      </div>
    </Page>
  );
}
