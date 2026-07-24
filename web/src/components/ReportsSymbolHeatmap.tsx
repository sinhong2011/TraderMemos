import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { Card } from "./Card";
import { ChartFrame, chartTheme } from "./ChartFrame";
import { EmptyState } from "./EmptyState";
import { useReportsMoney } from "./ReportsDisplayContext";
import { Skeleton } from "./Skeleton";
import type { BreakGroup } from "../lib/api/types";
import { usePrivacyMode } from "../lib/displayPrefs";

export interface ReportsSymbolHeatmapProps {
  breakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
}

export interface HeatmapNode {
  name: string;
  size: number;
  netPnl: number;
}

/**
 * One treemap node per symbol that has trades; area (size) encodes trade
 * count. `pnlOf` defaults to raw net_pnl but callers pass a net/gross-aware
 * money.pnl() so the tile color/opacity and displayed value honor the
 * Reports display mode (this is a plain function, so it can't call the
 * useReportsMoney() hook itself).
 */
export function buildHeatmapNodes(
  breakdown: BreakGroup[],
  pnlOf: (g: BreakGroup) => number = (g) => g.summary.net_pnl,
): HeatmapNode[] {
  return breakdown
    .filter((g) => g.summary.total_trades > 0)
    .map((g) => ({ name: g.key, size: g.summary.total_trades, netPnl: pnlOf(g) }));
}

/** Diverging fill: profit green / loss rose, opacity by |netPnl| vs the largest mover. */
export function tileStyle(netPnl: number, maxAbs: number): { fill: string; fillOpacity: number } {
  const fillOpacity = 0.25 + 0.6 * Math.min(1, Math.abs(netPnl) / Math.max(1, maxAbs));
  return { fill: netPnl >= 0 ? "var(--profit)" : "var(--loss)", fillOpacity };
}

export interface HeatCellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  netPnl?: number;
  payload?: HeatmapNode;
  maxAbs: number;
}

/** Exported for direct testing — recharts' Treemap `content` renders zero-size
 * cells in jsdom (no real layout), so tests render this in isolation with
 * explicit width/height instead of through the full chart. */
export function HeatCell({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name,
  netPnl,
  payload,
  maxAbs,
}: HeatCellProps) {
  const money = useReportsMoney();
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
        stroke="var(--card)"
        strokeWidth={1}
      />
      {showText ? (
        <>
          <text x={x + 6} y={y + 16} fontSize={11} fontWeight={600} fill="var(--foreground)">
            {label}
          </text>
          <text x={x + 6} y={y + 30} fontSize={10} fill="var(--muted-foreground)">
            {money.formatCompact(net)}
          </text>
        </>
      ) : null}
    </g>
  );
}

export function ReportsSymbolHeatmap({ breakdown, loading, error }: ReportsSymbolHeatmapProps) {
  usePrivacyMode();
  const money = useReportsMoney();
  const nodes = buildHeatmapNodes(breakdown, (g) => money.pnl(g.summary));
  const maxAbs = Math.max(1, ...nodes.map((n) => Math.abs(n.netPnl)));

  return (
    <Card title="Stock P&L">
      {loading ? (
        <Skeleton height="220px" />
      ) : error ? (
        <p className="text-xs text-destructive">Failed to load stock P&L.</p>
      ) : nodes.length === 0 ? (
        <EmptyState title="No data" hint="Add trades or adjust filters to see the heatmap." />
      ) : (
        <ChartFrame className="border-0 rounded-none">
          <ResponsiveContainer width="100%" height={240}>
            <Treemap
              data={nodes as any}
              dataKey="size"
              isAnimationActive={false}
              content={<HeatCell maxAbs={maxAbs} />}
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
                  return [`${money.format(p.netPnl)} · ${p.size} trades`, p.name];
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        </ChartFrame>
      )}
    </Card>
  );
}
