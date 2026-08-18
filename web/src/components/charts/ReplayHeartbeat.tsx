import { useMemo } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, YAxis } from "recharts";
import type { BarInterval, MarketBar } from "@/lib/api/market";
import { computeReplayPnl, type ReplayFillInput } from "./replayPnl";

/**
 * The replay's heartbeat: running net P&L up to the cursor, growing as the
 * tape plays (the mobile replay stage's chart). A plain sparkline over bar
 * index — no axes or tooltip, the transport above already narrates the
 * numbers. The dashed zero line doubles as a baseline and is pinned into the
 * domain, so sign never has to be read off an axis.
 */
export function ReplayHeartbeat({
  fills,
  bars,
  interval,
  cursor,
}: {
  fills: ReplayFillInput[];
  bars: MarketBar[];
  interval: BarInterval;
  cursor: number;
}) {
  // The full run is O(bars × fills) once; each tick then only slices.
  const series = useMemo(
    () => bars.map((_, i) => ({ i, net: computeReplayPnl(fills, bars, i, interval)?.net ?? 0 })),
    [fills, bars, interval],
  );

  if (cursor <= 0) return null;
  const shown = series.slice(0, cursor + 1);
  const color = (shown[shown.length - 1]?.net ?? 0) >= 0 ? "var(--profit)" : "var(--loss)";

  return (
    <ResponsiveContainer width="100%" height={72}>
      <AreaChart data={shown} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
        {/* Hidden axis whose domain pins zero, keeping the baseline honest. */}
        <YAxis
          hide
          domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
        />
        <ReferenceLine y={0} stroke="var(--flat)" strokeDasharray="3 4" strokeWidth={1} />
        <Area
          type="monotone"
          dataKey="net"
          stroke={color}
          strokeWidth={2}
          fill={color}
          fillOpacity={0.12}
          baseValue={0}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
