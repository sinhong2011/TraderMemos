import { BarChart } from 'panelui-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { useBreakdown, type BreakdownDim } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { Segmented } from '@/components/segmented';
import { t } from '@lingui/core/macro';
import { useGlobalFilters } from '@/lib/filters';
import { usePnlPalette } from '@/styles/pnl';

/** Net P&L per group, best → worst, like the web chart. */
const MAX_GROUPS = 8;

/** Width ÷ height of the plot — the old fixed 200pt at a phone's card width. */
const CHART_ASPECT = 1.8;

/** Web dashboard's breakdown bar chart (Day / Setup / Symbol), drawn in JS. */
export function BreakdownCard() {
  const palette = usePnlPalette();
  const [dim, setDim] = useState<BreakdownDim>('day_of_week');
  const { data, isLoading, error } = useBreakdown(dim, useGlobalFilters());

  const dims = [
    { value: 'day_of_week' as const, label: t`Day` },
    { value: 'setup' as const, label: t`Setup` },
    { value: 'symbol' as const, label: t`Symbol` },
  ];

  /*
   * A bar series carries one color, so the sign split is two series rather than
   * a per-bar tint: each row fills exactly one of them and leaves the other
   * null. Stacked, so both draw at the band's full width instead of standing
   * side by side in half of it.
   */
  const chartData = (data ?? []).slice(0, MAX_GROUPS).map((group) => ({
    name: group.key.length > 8 ? `${group.key.slice(0, 7)}…` : group.key,
    profit: group.summary.net_pnl >= 0 ? group.summary.net_pnl : null,
    loss: group.summary.net_pnl < 0 ? group.summary.net_pnl : null,
  }));

  return (
    <DashboardCard
      title={t`Breakdown`}
      control={<Segmented options={dims} value={dim} onChange={setDim} />}
    >
      {error ? (
        <Text className="py-4 text-[13px] text-muted-foreground">{t`Failed to load breakdown.`}</Text>
      ) : !isLoading && chartData.length === 0 ? (
        <Text className="py-4 text-[13px] text-muted-foreground">{t`No breakdown data yet.`}</Text>
      ) : (
        <BarChart
          data={chartData}
          xDataKey="name"
          stacked
          status={isLoading ? 'loading' : 'ready'}
          aspectRatio={CHART_ASPECT}
          cornerRadius={2}
          accessibilityLabel={t`Net P&L by group`}
        >
          <BarChart.Skeleton />
          <BarChart.Grid />
          <BarChart.Bar dataKey="profit" color={palette.profit} />
          <BarChart.Bar dataKey="loss" color={palette.loss} />
          <BarChart.XAxis />
        </BarChart>
      )}
    </DashboardCard>
  );
}
