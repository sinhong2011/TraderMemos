import { LineChart, Skeleton } from 'panelui-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { useTrades } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { ErrorState } from '@/components/error-state';
import { Segmented } from '@/components/segmented';
import {
  SectionScaffold,
  useReportsFilters,
  useReportsMoney,
} from '@/components/reports/section-scaffold';
import { t } from '@lingui/core/macro';
import { formatPercent, formatRatio, useFormatters } from '@/lib/format';
import {
  metricEvolution,
  rollingWinRate,
  type EvolutionGranularity,
} from '@/lib/reports-analytics';

/** Rolling-window sizes offered by the web SegmentedControl. */
const WINDOWS = ['10', '20', '50', '100'] as const;

type RightMetric = 'cumulativePnl' | 'profitFactor' | 'expectancy';

/** Downsampling cap — a phone-width plot doesn't need 1k marks. */
const MAX_POINTS = 120;

/**
 * The coin-flip line, carried as a flat second series: PanelUI's charts have no
 * reference-line part, and a dashed constant is the same picture — it also
 * pins 50% inside the y-domain, which a bare annotation would not.
 */
const EVEN = 50;

function sample<T>(points: T[]): T[] {
  if (points.length <= MAX_POINTS) return points;
  const step = points.length / MAX_POINTS;
  const sampled: T[] = [];
  for (let i = 0; i < MAX_POINTS - 1; i++) sampled.push(points[Math.floor(i * step)]);
  sampled.push(points[points.length - 1]);
  return sampled;
}

export function WinLossSection({
  onScrolledChange,
}: {
  onScrolledChange?: (scrolled: boolean) => void;
}) {
  const [primary, heading, mutedForeground] = useCSSVariable([
    '--color-primary',
    '--color-heading',
    '--color-muted-foreground',
  ]) as [string, string, string];
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatPnl } = useFormatters();
  const filters = useReportsFilters();
  const ctx = useReportsMoney();
  const trades = useTrades(filters);

  const [windowSize, setWindowSize] = useState<(typeof WINDOWS)[number]>('20');
  const [granularity, setGranularity] = useState<EvolutionGranularity>('week');
  const [rightMetric, setRightMetric] = useState<RightMetric>('cumulativePnl');

  const tradeList = useMemo(() => trades.data ?? [], [trades.data]);

  const rolling = useMemo(
    () => sample(rollingWinRate(tradeList, Number(windowSize))),
    [tradeList, windowSize],
  );
  const evolution = useMemo(
    () => metricEvolution(tradeList, granularity, ctx.money.tradePnl),
    [tradeList, granularity, ctx.money.tradePnl],
  );

  const windows = WINDOWS.map((w) => ({ value: w, label: w }));
  const granularities = [
    { value: 'day' as const, label: t`Day` },
    { value: 'week' as const, label: t`Week` },
    { value: 'month' as const, label: t`Month` },
  ];
  const rightMetrics = [
    { value: 'cumulativePnl' as const, label: t`P&L` },
    { value: 'profitFactor' as const, label: t`PF` },
    { value: 'expectancy' as const, label: t`Expect` },
  ];

  const rollingData = rolling.map((point) => ({
    i: point.index,
    rate: point.rate * 100,
    even: EVEN,
  }));
  const latestRate = rolling.length > 0 ? rolling[rolling.length - 1].rate : null;

  const winRateData = evolution.map((point, index) => ({
    i: index,
    rate: point.winRate * 100,
    even: EVEN,
  }));
  const metricData = evolution.map((point, index) => {
    const value =
      rightMetric === 'profitFactor'
        ? point.profitFactor
        : rightMetric === 'expectancy'
          ? ctx.money.display(point.expectancy)
          : ctx.money.display(point.cumulativePnl);
    return { i: index, value };
  });
  const latest = evolution.length > 0 ? evolution[evolution.length - 1] : null;

  // The metric series is plotted *already converted* by `money.display`, so the
  // readout formats it directly — `money.format` would apply the FX rate (or
  // the %-of-deposits divisor) a second time.
  const formatPlotted = (value: number) =>
    ctx.money.unitMode === 'pct' ? formatPercent(value) : formatPnl(value, ctx.currency);

  return (
    <SectionScaffold refreshing={trades.isRefetching} onScrolledChange={onScrolledChange}>
      {trades.isLoading ? (
        <>
          <Skeleton className="h-[260px] rounded-[18px]" label={t`Loading win/loss report`} />
          <Skeleton className="h-[260px] rounded-[18px]" />
        </>
      ) : trades.error && trades.data == null ? (
        // Boxed rather than flexed: the scaffold's scroll content has no height
        // of its own, so a `flex: 1` failure state would collapse to nothing.
        <View className="min-h-[320px]">
          <ErrorState
            error={trades.error}
            onRetry={() => void trades.refetch()}
            retrying={trades.isRefetching}
          />
        </View>
      ) : (
        <>
          <DashboardCard
            title={t`Rolling win rate`}
            control={
              <Segmented compact options={windows} value={windowSize} onChange={setWindowSize} />
            }
          >
            {rolling.length === 0 ? (
              <Text className="py-4 text-[13px] text-muted-foreground">
                {t`Need at least ${windowSize} closed trades to fill the window.`}
              </Text>
            ) : (
              <>
                <Text className="text-[22px] font-semibold tabular-nums text-foreground">
                  {formatPercent(latestRate ?? 0)}
                  <Text className="text-[13px] font-normal text-muted-foreground">
                    {' '}
                    {t`over the last ${windowSize} trades`}
                  </Text>
                </Text>
                <LineChart data={rollingData} xDataKey="i" aspectRatio={1.9}>
                  <LineChart.Grid />
                  <LineChart.Area dataKey="rate" color={primary} />
                  <LineChart.Line dataKey="rate" color={primary} />
                  <LineChart.Line
                    dataKey="even"
                    color={mutedForeground}
                    strokeWidth={1}
                    dashArray="4,4"
                  />
                  <LineChart.Tooltip
                    color={primary}
                    formatValue={(v) => formatPercent(v / 100)}
                    formatX={(datum) => t`Trade ${String(datum.i)}`}
                  />
                </LineChart>
                <Text className="text-xs text-muted-foreground">
                  {t`Each point is the win rate across the trailing ${windowSize} closed trades.`}
                </Text>
              </>
            )}
          </DashboardCard>

          <DashboardCard
            title={t`Metric evolution`}
            control={
              <Segmented
                compact
                options={granularities}
                value={granularity}
                onChange={setGranularity}
              />
            }
          >
            {evolution.length === 0 ? (
              <Text className="py-4 text-[13px] text-muted-foreground">{t`No closed trades in this range.`}</Text>
            ) : (
              <>
                <Text className="text-xs font-medium text-muted-foreground">{t`Win rate (%)`}</Text>
                <LineChart data={winRateData} xDataKey="i" aspectRatio={2.4}>
                  <LineChart.Grid />
                  <LineChart.Line dataKey="rate" color={primary} />
                  <LineChart.Line
                    dataKey="even"
                    color={mutedForeground}
                    strokeWidth={1}
                    dashArray="4,4"
                  />
                  <LineChart.Tooltip color={primary} formatValue={(v) => formatPercent(v / 100)} />
                </LineChart>

                {/* One metric per panel rather than a shared dual axis: two
                    series on one y-scale would put a profit factor of 1.4 and a
                    five-figure cumulative P&L on the same axis. */}
                {/* justify-end on a row, not items-end on a column: Segmented
                    carries self-start, which overrides a parent's cross-axis
                    alignment and drags it back to the left edge. */}
                <View className="flex-row justify-end">
                  <Segmented
                    compact
                    options={rightMetrics}
                    value={rightMetric}
                    onChange={setRightMetric}
                  />
                </View>
                <LineChart data={metricData} xDataKey="i" aspectRatio={2.4}>
                  <LineChart.Grid />
                  {rightMetric === 'profitFactor' ? null : (
                    <LineChart.Area dataKey="value" color={heading} />
                  )}
                  <LineChart.Line dataKey="value" color={heading} />
                  <LineChart.Tooltip
                    color={heading}
                    formatValue={(v) =>
                      rightMetric === 'profitFactor' ? formatRatio(v) : formatPlotted(v)
                    }
                  />
                </LineChart>
                {latest ? (
                  <Text className="text-xs text-muted-foreground">
                    {t`To date: ${formatPercent(latest.winRate)} win rate · PF ${formatRatio(latest.profitFactor)} · ${ctx.money.format(latest.cumulativePnl)} cumulative`}
                  </Text>
                ) : null}
              </>
            )}
          </DashboardCard>
        </>
      )}
    </SectionScaffold>
  );
}
