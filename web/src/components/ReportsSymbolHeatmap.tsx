import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { Card } from "./Card";
import { ChartFrame, chartTheme } from "./ChartFrame";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import type { BreakGroup } from "../lib/api/types";
import { usePrivacyMode } from "../lib/displayPrefs";
import { fmtMoneyCompact, fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";

export interface ReportsSymbolHeatmapProps {
  breakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
  currency: string;
  fxRate?: number;
}

export interface HeatmapNode {
  name: string;
  size: number;
  netPnl: number;
}

/** One treemap node per symbol that has trades; area (size) encodes trade count. */
export function buildHeatmapNodes(breakdown: BreakGroup[]): HeatmapNode[] {
  return breakdown
    .filter((g) => g.summary.total_trades > 0)
    .map((g) => ({ name: g.key, size: g.summary.total_trades, netPnl: g.summary.net_pnl }));
}

/** Diverging fill: profit green / loss rose, opacity by |netPnl| vs the largest mover. */
export function tileStyle(netPnl: number, maxAbs: number): { fill: string; fillOpacity: number } {
  const fillOpacity = 0.25 + 0.6 * Math.min(1, Math.abs(netPnl) / Math.max(1, maxAbs));
  return { fill: netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)", fillOpacity };
}

interface HeatCellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  netPnl?: number;
  payload?: HeatmapNode;
  maxAbs: number;
  currency: string;
  fxRate: number;
  locale: string;
}

function HeatCell({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name,
  netPnl,
  payload,
  maxAbs,
  currency,
  fxRate,
  locale,
}: HeatCellProps) {
  if (width <= 0 || height <= 0) return null;
  // recharts spreads the node onto the cell props; fall back to payload if not.
  const net = netPnl ?? payload?.netPnl ?? 0;
  const label = name ?? payload?.name ?? "";
  const { fill, fillOpacity } = tileStyle(net, maxAbs);
  const showText = width > 44 && height > 28;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke="var(--color-bg-panel)"
        strokeWidth={1}
      />
      {showText ? (
        <>
          <text x={x + 6} y={y + 16} fontSize={11} fontWeight={600} fill="var(--color-text)">
            {label}
          </text>
          <text x={x + 6} y={y + 30} fontSize={10} fill="var(--color-text-muted)">
            {fmtMoneyCompact(net * fxRate, currency, locale)}
          </text>
        </>
      ) : null}
    </g>
  );
}

export function ReportsSymbolHeatmap({
  breakdown,
  loading,
  error,
  currency,
  fxRate = 1,
}: ReportsSymbolHeatmapProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const nodes = buildHeatmapNodes(breakdown);
  const maxAbs = Math.max(1, ...nodes.map((n) => Math.abs(n.netPnl)));

  return (
    <Card title="Stock P&L">
      {loading ? (
        <Skeleton height="220px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load stock P&L.</p>
      ) : nodes.length === 0 ? (
        <EmptyState title="No data" hint="Add trades or adjust filters to see the heatmap." />
      ) : (
        <ChartFrame className="border-0 rounded-none">
          <ResponsiveContainer width="100%" height={240}>
            <Treemap
              data={nodes as any}
              dataKey="size"
              isAnimationActive={false}
              content={
                <HeatCell maxAbs={maxAbs} currency={currency} fxRate={fxRate} locale={locale} />
              }
            >
              <Tooltip
                contentStyle={{
                  background: chartTheme.tooltipBg,
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  color: chartTheme.tooltipText,
                  fontSize: 11,
                }}
                formatter={(_v, _n, item) => {
                  const p = item?.payload as HeatmapNode | undefined;
                  if (!p) return ["", ""];
                  return [
                    `${fmtSignedMoney(p.netPnl * fxRate, currency, locale)} · ${p.size} trades`,
                    p.name,
                  ];
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        </ChartFrame>
      )}
    </Card>
  );
}
