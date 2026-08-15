import { useRouter } from 'expo-router';
import { Skeleton } from 'panelui-native';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTrades } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { InlineError } from '@/components/error-state';
import {
  useReportsFilters,
  type ReportsMoneyContext,
} from '@/components/reports/section-scaffold';
import { t } from '@lingui/core/macro';
import { useFormatters } from '@/lib/format';
import { computePnlHeatmap, HEATMAP_DAY_LABELS } from '@/lib/pnl-heatmap';
import { resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';
import { pnlBgTint, usePnlPalette } from '@/styles/pnl';

export function heatmapDayLabel(day: number): string {
  switch (HEATMAP_DAY_LABELS[day]) {
    case 'Mon':
      return t`Mon`;
    case 'Tue':
      return t`Tue`;
    case 'Wed':
      return t`Wed`;
    case 'Thu':
      return t`Thu`;
    case 'Fri':
      return t`Fri`;
    case 'Sat':
      return t`Sat`;
    default:
      return t`Sun`;
  }
}

/**
 * Weekday × entry-hour P&L grid over the Reports-filtered trades, on the
 * market clock. Tapping a traded cell opens the cell-details sheet — the
 * phone's answer to web's hover tooltip + click popover.
 *
 * Hand-built rather than PanelUI's `HeatmapChart`: that one washes a single
 * base colour through a four-step quantile ramp, which cannot say *green above
 * zero, red below it* — and its cells report a drag, not a tap, so there would
 * be nothing to push the day/hour sheet from.
 */
export function PnlHeatmapCard({ ctx }: { ctx: ReportsMoneyContext }) {
  const palette = usePnlPalette();
  const router = useRouter();
  const prefs = useDisplayPrefs();
  const { formatHourKeyLabel } = useFormatters();
  const marketTz = resolveMarketTimezone(prefs.marketTimezone);
  const filters = useReportsFilters();
  const trades = useTrades(filters);
  const { money } = ctx;

  const gross = money.pnlMode === 'gross';
  const heatmap = useMemo(
    // Mirrors reportsMoney().tradePnl — inlined so the memo can key on the
    // mode instead of a per-render closure.
    () =>
      computePnlHeatmap(
        trades.data ?? [],
        marketTz,
        gross ? (tr) => tr.gross_pnl ?? tr.net_pnl ?? 0 : undefined,
      ),
    [trades.data, marketTz, gross],
  );

  if (trades.isLoading) {
    return (
      <DashboardCard title={t`P&L heatmap`}>
        <Skeleton className="h-[220px] rounded-lg" />
      </DashboardCard>
    );
  }
  if (trades.error && trades.data == null) {
    return (
      <DashboardCard title={t`P&L heatmap`}>
        <InlineError error={trades.error} onRetry={() => void trades.refetch()} />
      </DashboardCard>
    );
  }
  if (heatmap.total === 0) {
    return (
      <DashboardCard title={t`P&L heatmap`}>
        <Text className="py-4 text-[13px] text-muted-foreground">{t`No trades in this range.`}</Text>
      </DashboardCard>
    );
  }

  const hours = Array.from(
    { length: heatmap.hourEnd - heatmap.hourStart + 1 },
    (_, i) => heatmap.hourStart + i,
  );

  return (
    <DashboardCard title={t`P&L heatmap`}>
      <View className="mb-0.5 flex-row items-center gap-0.5">
        <View className="w-[34px]" />
        {hours.map((hour) => (
          <Text
            key={hour}
            className="flex-1 text-center text-[8px] tabular-nums text-muted-foreground"
            numberOfLines={1}
          >
            {hour}
          </Text>
        ))}
      </View>
      {heatmap.days.map((day) => (
        <View key={day} className="mb-0.5 flex-row items-center gap-0.5">
          <Text className="w-[34px] text-[11px] font-medium text-muted-foreground">
            {heatmapDayLabel(day)}
          </Text>
          {hours.map((hour) => {
            const cell = heatmap.grid[day][hour];
            const label = `${heatmapDayLabel(day)} ${formatHourKeyLabel(`${String(hour).padStart(2, '0')}:00`)}`;
            return (
              <Pressable
                key={hour}
                disabled={cell.trades === 0}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/(dashboard)/heatmap-cell',
                    params: { day: String(day), hour: String(hour) },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={
                  cell.trades > 0
                    ? t`${label} — ${money.format(cell.pnl)} · ${cell.trades} trades`
                    : t`${label} — no trades`
                }
                className="aspect-square flex-1 rounded-[3px] bg-muted active:border-[1.5px] active:border-foreground"
                style={
                  cell.trades > 0
                    ? { backgroundColor: pnlBgTint(palette, cell.pnl, heatmap.maxAbsPnl) }
                    : undefined
                }
              />
            );
          })}
        </View>
      ))}
      <Text className="mt-2 text-xs tabular-nums text-muted-foreground">
        {t`Closed-trade P&L by entry time on the market clock. Tap a cell for its trades.`}
      </Text>
    </DashboardCard>
  );
}
