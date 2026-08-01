import { Chart, Host } from '@expo/ui/swift-ui';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { EquityCurve } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { Segmented } from '@/components/segmented';
import { t } from '@lingui/core/macro';
import { formatCurrency, formatPnl } from '@/lib/format';
import { pnlColor } from '@/styles/unistyles';

type Range = '30D' | '90D' | 'ALL';

const RANGES: { value: Range; label: string }[] = [
  { value: '30D', label: '30D' },
  { value: '90D', label: '90D' },
  { value: 'ALL', label: 'ALL' },
];

function rangeCutoff(range: Range): number | null {
  if (range === 'ALL') return null;
  const days = range === '30D' ? 30 : 90;
  return Date.now() - days * 86400_000;
}

/** Keeps the native chart light — Swift Charts doesn't need 1k marks for a phone-width line. */
const MAX_POINTS = 120;

/** Equity curve card with the web's 30D/90D/ALL range switcher, drawn by Swift Charts. */
export function EquityCard({ curve, currency }: { curve: EquityCurve; currency: string }) {
  const { theme } = useUnistyles();
  const [range, setRange] = useState<Range>('30D');

  const visible = useMemo(() => {
    const cutoff = rangeCutoff(range);
    const filtered = cutoff
      ? curve.points.filter((p) => new Date(p.at).getTime() >= cutoff)
      : curve.points;
    if (filtered.length <= MAX_POINTS) return filtered;
    const step = filtered.length / MAX_POINTS;
    const sampled = [];
    for (let i = 0; i < MAX_POINTS - 1; i++) sampled.push(filtered[Math.floor(i * step)]);
    sampled.push(filtered[filtered.length - 1]);
    return sampled;
  }, [curve.points, range]);

  const data = useMemo(
    () => visible.map((point, index) => ({ x: index, y: point.equity })),
    [visible],
  );

  if (visible.length === 0) {
    return (
      <DashboardCard
        title={t`Equity curve`}
        control={<Segmented options={RANGES} value={range} onChange={setRange} />}
      >
        <Text style={styles.empty}>{t`No equity data in this range.`}</Text>
      </DashboardCard>
    );
  }

  const first = visible[0].equity;
  const last = visible[visible.length - 1].equity;
  const delta = last - first;

  return (
    <DashboardCard
      title={t`Equity curve`}
      control={<Segmented options={RANGES} value={range} onChange={setRange} />}
    >
      <View style={styles.headline}>
        <Text selectable style={styles.equityValue}>
          {formatCurrency(last, currency)}
        </Text>
        <Text style={[styles.delta, { color: pnlColor(theme.colors, delta) }]}>
          {formatPnl(delta, currency)}
        </Text>
      </View>

      <Host style={styles.chart}>
        <Chart
          data={data}
          type="line"
          animate
          lineStyle={{ color: theme.colors.primary, width: 2 }}
          referenceLines={[{ x: 'start', y: first }]}
          ruleStyle={{ color: '#80808055', lineWidth: 1, dashArray: [4, 4] }}
        />
      </Host>

      {curve.max_drawdown > 0 ? (
        <Text style={styles.caption}>
          {t`Max drawdown`}{' '}
          <Text style={[styles.captionValue, { color: pnlColor(theme.colors, -curve.max_drawdown) }]}>
            {formatPnl(-curve.max_drawdown, currency)}
          </Text>
        </Text>
      ) : null}
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.md },
  equityValue: { fontSize: 22, fontWeight: '600', color: theme.colors.foreground, ...theme.numeric },
  delta: { fontSize: 15, fontWeight: '500', ...theme.numeric },
  chart: { height: 190 },
  caption: { fontSize: 12, color: theme.colors.mutedForeground },
  captionValue: { fontWeight: '500', ...theme.numeric },
  empty: { fontSize: 13, color: theme.colors.mutedForeground, paddingVertical: theme.spacing.lg },
}));
