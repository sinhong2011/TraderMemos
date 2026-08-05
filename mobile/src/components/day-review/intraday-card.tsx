import { Chart, Host } from '@expo/ui/swift-ui';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Trade } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { curveDrawdown, intradayCurve } from '@/lib/day-review';
import { formatPnl, formatTime } from '@/lib/format';
import { useDisplayPrefs } from '@/lib/prefs';
import { pnlColor } from '@/styles/unistyles';

/**
 * Cumulative realized P&L as the session unfolded — the shape of the day, which
 * one net number hides (a flat grind and a blown lead can end identically).
 */
export function IntradayCard({
  trades,
  loading,
  currency,
  fxRate = 1,
}: {
  trades: Trade[];
  loading: boolean;
  currency: string;
  /** Base→display conversion applied before formatting (1 = account currency). */
  fxRate?: number;
}) {
  const { theme } = useUnistyles();
  // Re-render when privacy mode flips — formatters read it at call time.
  useDisplayPrefs();

  const points = useMemo(() => intradayCurve(trades, fxRate), [trades, fxRate]);
  const data = useMemo(
    () => points.map((point, index) => ({ x: index, y: point.cumulative })),
    [points],
  );

  if (loading) {
    return (
      <DashboardCard title={t`Intraday P&L`}>
        <Skeleton style={styles.chart} />
      </DashboardCard>
    );
  }

  if (points.length < 2) {
    return (
      <DashboardCard title={t`Intraday P&L`}>
        <Text style={styles.empty}>{t`Not enough closed trades to draw a session curve.`}</Text>
      </DashboardCard>
    );
  }

  const last = points[points.length - 1];
  const peak = Math.max(...points.map((point) => point.cumulative), 0);
  const drawdown = curveDrawdown(points);

  return (
    <DashboardCard title={t`Intraday P&L`}>
      <View style={styles.headline}>
        <Text style={styles.window}>
          {formatTime(points[0].at)} – {formatTime(last.at)}
        </Text>
        <Text style={styles.count}>{t`${points.length} trades`}</Text>
      </View>

      <Host style={styles.chart}>
        <Chart
          data={data}
          type="line"
          animate
          showGrid={false}
          lineStyle={{ color: pnlColor(theme.colors, last.cumulative), width: 2 }}
          referenceLines={[{ x: 'start', y: 0 }]}
          ruleStyle={{ color: '#80808055', lineWidth: 1, dashArray: [4, 4] }}
        />
      </Host>

      <Text style={styles.caption}>
        {t`Peak`}{' '}
        <Text style={[styles.captionValue, { color: pnlColor(theme.colors, peak) }]}>
          {formatPnl(peak, currency)}
        </Text>
        {'  ·  '}
        {t`Drawdown`}{' '}
        <Text style={[styles.captionValue, { color: pnlColor(theme.colors, -drawdown) }]}>
          {formatPnl(-drawdown, currency)}
        </Text>
      </Text>
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  headline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  window: { fontSize: 13, color: theme.colors.foreground, ...theme.numeric },
  count: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  chart: { height: 170 },
  caption: { fontSize: 12, color: theme.colors.mutedForeground },
  captionValue: { fontWeight: '500', ...theme.numeric },
  empty: { fontSize: 13, color: theme.colors.mutedForeground, paddingVertical: theme.spacing.sm },
}));
