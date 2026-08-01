import { Chart, Host } from '@expo/ui/swift-ui';
import { useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useBreakdown, type BreakdownDim } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { Segmented } from '@/components/segmented';
import { t } from '@lingui/core/macro';

/** Net P&L per group, best → worst, like the web chart. */
const MAX_GROUPS = 8;

/** Web dashboard's breakdown bar chart (Day / Setup / Symbol), drawn by Swift Charts. */
export function BreakdownCard() {
  const { theme } = useUnistyles();
  const [dim, setDim] = useState<BreakdownDim>('day_of_week');
  const { data, isLoading, error } = useBreakdown(dim);

  const dims = [
    { value: 'day_of_week' as const, label: t`Day` },
    { value: 'setup' as const, label: t`Setup` },
    { value: 'symbol' as const, label: t`Symbol` },
  ];

  const chartData = (data ?? []).slice(0, MAX_GROUPS).map((group) => ({
    x: group.key.length > 8 ? `${group.key.slice(0, 7)}…` : group.key,
    y: group.summary.net_pnl,
    color: group.summary.net_pnl >= 0 ? theme.colors.profit : theme.colors.loss,
  }));

  return (
    <DashboardCard
      title={t`Breakdown`}
      control={<Segmented options={dims} value={dim} onChange={setDim} />}
    >
      {isLoading ? (
        <ActivityIndicator style={styles.placeholder} />
      ) : error ? (
        <Text style={styles.empty}>{t`Failed to load breakdown.`}</Text>
      ) : chartData.length === 0 ? (
        <Text style={styles.empty}>{t`No breakdown data yet.`}</Text>
      ) : (
        <Host style={styles.chart}>
          <Chart data={chartData} type="bar" showGrid animate barStyle={{ cornerRadius: 2 }} />
        </Host>
      )}
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  chart: { height: 200 },
  placeholder: { paddingVertical: theme.spacing.xl * 2 },
  empty: { fontSize: 13, color: theme.colors.mutedForeground, paddingVertical: theme.spacing.lg },
}));
