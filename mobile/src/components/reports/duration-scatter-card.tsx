import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line as SvgLine, Text as SvgText } from 'react-native-svg';

import { useTrades } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { InlineError } from '@/components/error-state';
import { Skeleton } from 'panelui-native';
import { t } from '@lingui/core/macro';
import { formatDuration } from '@/lib/format';
import { durationScatter, medianDurationSecs } from '@/lib/reports-analytics';
import {
  useReportsFilters,
  type ReportsMoneyContext,
} from '@/components/reports/section-scaffold';
import { usePnlPalette } from '@/styles/pnl';
import { useCSSVariable } from 'uniwind';

const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 22, left: 8 };

/** Candidate log-axis ticks: 1m, 5m, 15m, 1h, 4h, 1d, 1w, 1mo. */
const DURATION_TICKS = [60, 300, 900, 3600, 14400, 86400, 604800, 2592000];

/**
 * Hold time (log x) vs P&L scatter — the shape the duration buckets flatten.
 * Hand-drawn on react-native-svg: PanelUI's Plot positions marks by row index,
 * so a true log-scaled x axis isn't expressible with its primitives (same
 * reason the P&L heatmap is hand-rolled). Web ReportsDurationScatter parity.
 */
export function DurationScatterCard({ ctx }: { ctx: ReportsMoneyContext }) {
  const filters = useReportsFilters();
  const trades = useTrades(filters);
  const palette = usePnlPalette();
  const [mutedForeground, border] = useCSSVariable([
    '--color-muted-foreground',
    '--color-border',
  ]) as [string, string];
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const points = durationScatter(trades.data ?? [], ctx.money.tradePnl);
  const median = medianDurationSecs(points);

  let body = null;
  if (trades.isLoading) {
    body = <Skeleton className="h-[220px] rounded-lg" />;
  } else if (trades.error && trades.data == null) {
    body = <InlineError error={trades.error} onRetry={() => void trades.refetch()} />;
  } else if (points.length === 0) {
    body = (
      <Text className="py-4 text-[13px] text-muted-foreground">
        {t`Close trades with hold times to see the scatter.`}
      </Text>
    );
  } else if (width > 0) {
    const plotW = width - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const logMin = Math.log10(Math.max(1, Math.min(...points.map((p) => p.secs))));
    const logMax = Math.log10(Math.max(...points.map((p) => p.secs)));
    const logSpan = Math.max(0.001, logMax - logMin);
    const values = points.map((p) => ctx.money.display(p.pnl));
    const vMin = Math.min(0, ...values);
    const vMax = Math.max(0, ...values);
    const vSpan = Math.max(1e-9, vMax - vMin);

    const x = (secs: number) =>
      PAD.left + ((Math.log10(Math.max(1, secs)) - logMin) / logSpan) * plotW;
    const y = (value: number) => PAD.top + (1 - (value - vMin) / vSpan) * plotH;

    const ticks = DURATION_TICKS.filter(
      (tick) => Math.log10(tick) >= logMin && Math.log10(tick) <= logMax,
    );

    body = (
      <Svg width={width} height={HEIGHT}>
        {/* zero line */}
        <SvgLine
          x1={PAD.left}
          x2={PAD.left + plotW}
          y1={y(0)}
          y2={y(0)}
          stroke={border}
          strokeWidth={1}
        />
        {/* median hold */}
        <SvgLine
          x1={x(median)}
          x2={x(median)}
          y1={PAD.top}
          y2={PAD.top + plotH}
          stroke={mutedForeground}
          strokeWidth={1}
          strokeDasharray="4,3"
        />
        <SvgText
          x={Math.min(x(median) + 4, width - 60)}
          y={PAD.top + 8}
          fontSize={9}
          fill={mutedForeground}
        >
          {t`median ${formatDuration(median)}`}
        </SvgText>
        {ticks.map((tick) => (
          <SvgText
            key={tick}
            x={x(tick)}
            y={HEIGHT - 8}
            fontSize={9}
            fill={mutedForeground}
            textAnchor="middle"
          >
            {formatDuration(tick)}
          </SvgText>
        ))}
        {points.map((p, i) => (
          <Circle
            key={p.id}
            cx={x(p.secs)}
            cy={y(values[i])}
            r={3}
            fill={p.pnl >= 0 ? palette.profit : palette.loss}
            fillOpacity={0.65}
          />
        ))}
      </Svg>
    );
  }

  return (
    <DashboardCard title={t`Duration vs P&L`}>
      <View onLayout={onLayout}>{body}</View>
      {points.length > 0 ? (
        <Text className="text-[10px] text-muted-foreground">
          {t`Hold time on a log scale · dashed line marks the median hold`}
        </Text>
      ) : null}
    </DashboardCard>
  );
}
