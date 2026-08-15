import { LineChart } from 'panelui-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import type { EquityCurve } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { Segmented } from '@/components/segmented';
import { t } from '@lingui/core/macro';
import { useFormatters } from '@/lib/format';
import { pnlClass, usePnlPalette } from '@/styles/pnl';

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

/** Keeps the plot light — a phone-width line doesn't need 1k marks. */
const MAX_POINTS = 120;

/** Equity curve card with the web's 30D/90D/ALL range switcher. */
export function EquityCard({
  curve,
  currency,
  fxRate = 1,
}: {
  curve: EquityCurve;
  currency: string;
  /** Base→display conversion applied before formatting (1 = account currency). */
  fxRate?: number;
}) {
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatPnl, formatDate } = useFormatters();
  const palette = usePnlPalette();
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
    () => visible.map((point) => ({ at: point.at, equity: point.equity * fxRate })),
    [visible, fxRate],
  );

  if (visible.length === 0) {
    return (
      <DashboardCard
        title={t`Equity curve`}
        control={<Segmented options={RANGES} value={range} onChange={setRange} />}
      >
        <Text className="py-4 text-[13px] text-muted-foreground">{t`No equity data in this range.`}</Text>
      </DashboardCard>
    );
  }

  const first = visible[0].equity * fxRate;
  const last = visible[visible.length - 1].equity * fxRate;
  const delta = last - first;
  // The run's own verdict tints the curve — a green line under a red delta was
  // the one reading the card could not survive.
  const curveColor = delta >= 0 ? palette.profit : palette.loss;

  return (
    <DashboardCard
      title={t`Equity curve`}
      control={<Segmented options={RANGES} value={range} onChange={setRange} />}
    >
      <View className="flex-row items-baseline gap-3">
        <Text selectable className="text-[22px] font-semibold tabular-nums text-foreground">
          {formatCurrency(last, currency)}
        </Text>
        <Text className={`text-[15px] font-medium tabular-nums ${pnlClass(delta)}`}>
          {formatPnl(delta, currency)}
        </Text>
      </View>

      <LineChart data={data} xDataKey="at" aspectRatio={1.9}>
        <LineChart.Grid />
        <LineChart.Area dataKey="equity" color={curveColor} />
        <LineChart.Line dataKey="equity" color={curveColor} />
        <LineChart.XAxis ticks={4} format={(datum) => formatDate(String(datum.at))} />
        <LineChart.Tooltip
          color={curveColor}
          formatValue={(value) => formatCurrency(value, currency)}
          formatX={(datum) => formatDate(String(datum.at))}
        />
      </LineChart>

      {curve.max_drawdown > 0 ? (
        <Text className="text-xs text-muted-foreground">
          {t`Max drawdown`}{' '}
          <Text className={`font-medium tabular-nums ${pnlClass(-curve.max_drawdown)}`}>
            {formatPnl(-curve.max_drawdown * fxRate, currency)}
          </Text>
        </Text>
      ) : null}
    </DashboardCard>
  );
}
