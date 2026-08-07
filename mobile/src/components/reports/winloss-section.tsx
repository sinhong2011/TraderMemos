import { Chart } from '@expo/ui/swift-ui';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useTrades } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { ErrorState } from '@/components/error-state';
import { Segmented } from '@/components/segmented';
import { Skeleton } from '@/components/skeleton';
import {
  SectionScaffold,
  useReportsFilters,
  useReportsMoney,
} from '@/components/reports/section-scaffold';
import { t } from '@lingui/core/macro';
import { formatPercent, formatRatio } from '@/lib/format';
import {
  metricEvolution,
  rollingWinRate,
  type EvolutionGranularity,
} from '@/lib/reports-analytics';
import { AppHost } from '@/components/app-host';

/** Rolling-window sizes offered by the web SegmentedControl. */
const WINDOWS = ['10', '20', '50', '100'] as const;

type RightMetric = 'cumulativePnl' | 'profitFactor' | 'expectancy';

/** Downsampling cap — Swift Charts doesn't need 1k marks at phone width. */
const MAX_POINTS = 120;

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
  const { theme } = useUnistyles();
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

  const rollingData = rolling.map((point) => ({ x: point.index, y: point.rate * 100 }));
  const latestRate = rolling.length > 0 ? rolling[rolling.length - 1].rate : null;

  const winRateData = evolution.map((point, index) => ({ x: index, y: point.winRate * 100 }));
  const metricData = evolution.map((point, index) => {
    const value =
      rightMetric === 'profitFactor'
        ? point.profitFactor
        : rightMetric === 'expectancy'
          ? ctx.money.display(point.expectancy)
          : ctx.money.display(point.cumulativePnl);
    return { x: index, y: value };
  });
  const latest = evolution.length > 0 ? evolution[evolution.length - 1] : null;

  return (
    <SectionScaffold refreshing={trades.isRefetching} onScrolledChange={onScrolledChange}>
      {trades.isLoading ? (
        <>
          <Skeleton style={styles.skeletonCard} />
          <Skeleton style={styles.skeletonCard} />
        </>
      ) : trades.error && trades.data == null ? (
        // Boxed rather than flexed: the scaffold's scroll content has no height
        // of its own, so a `flex: 1` failure state would collapse to nothing.
        <View style={styles.errorHost}>
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
            control={<Segmented compact options={windows} value={windowSize} onChange={setWindowSize} />}
          >
            {rolling.length === 0 ? (
              <Text style={styles.empty}>
                {t`Need at least ${windowSize} closed trades to fill the window.`}
              </Text>
            ) : (
              <>
                <Text style={styles.headline}>
                  {formatPercent(latestRate ?? 0)}
                  <Text style={styles.headlineSub}> {t`over the last ${windowSize} trades`}</Text>
                </Text>
                <AppHost style={styles.chart}>
                  <Chart
                    data={rollingData}
                    type="line"
                    animate
                    lineStyle={{ color: theme.colors.primary, width: 2 }}
                    referenceLines={[{ x: 'start', y: 50 }]}
                    ruleStyle={{ color: '#80808055', lineWidth: 1, dashArray: [4, 4] }}
                  />
                </AppHost>
                <Text style={styles.footnote}>
                  {t`Each point is the win rate across the trailing ${windowSize} closed trades.`}
                </Text>
              </>
            )}
          </DashboardCard>

          <DashboardCard
            title={t`Metric evolution`}
            control={
              <Segmented compact options={granularities} value={granularity} onChange={setGranularity} />
            }
          >
            {evolution.length === 0 ? (
              <Text style={styles.empty}>{t`No closed trades in this range.`}</Text>
            ) : (
              <>
                <Text style={styles.chartLabel}>{t`Win rate (%)`}</Text>
                <AppHost style={styles.chartShort}>
                  <Chart
                    data={winRateData}
                    type="line"
                    animate
                    lineStyle={{ color: theme.colors.primary, width: 2 }}
                    referenceLines={[{ x: 'start', y: 50 }]}
                    ruleStyle={{ color: '#80808055', lineWidth: 1, dashArray: [4, 4] }}
                  />
                </AppHost>

                {/* Swift Charts draws one series per host — the second metric
                    gets its own panel instead of a shared dual axis. */}
                <Segmented options={rightMetrics} value={rightMetric} onChange={setRightMetric} />
                <AppHost style={styles.chartShort}>
                  <Chart
                    data={metricData}
                    type={rightMetric === 'profitFactor' ? 'line' : 'area'}
                    animate
                    lineStyle={{ color: theme.colors.accent, width: 2 }}
                  />
                </AppHost>
                {latest ? (
                  <Text style={styles.footnote}>
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

const styles = StyleSheet.create((theme) => ({
  headline: { fontSize: 22, fontWeight: '600', color: theme.colors.foreground, ...theme.numeric },
  headlineSub: { fontSize: 13, fontWeight: '400', color: theme.colors.mutedForeground },
  chart: { height: 190 },
  chartShort: { height: 150 },
  chartLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.mutedForeground },
  footnote: { fontSize: 12, color: theme.colors.mutedForeground },
  empty: { fontSize: 13, color: theme.colors.mutedForeground, paddingVertical: theme.spacing.lg },
  skeletonCard: { height: 260, borderRadius: theme.radius.lg + 4 },
  errorHost: { minHeight: 320 },
}));
