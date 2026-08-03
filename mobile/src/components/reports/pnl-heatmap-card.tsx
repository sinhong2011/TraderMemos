import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useTrades } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import {
  useReportsFilters,
  type ReportsMoneyContext,
} from '@/components/reports/section-scaffold';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { computePnlHeatmap, HEATMAP_DAY_LABELS } from '@/lib/pnl-heatmap';
import { formatHourKeyLabel, resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';
import { pnlBgTint } from '@/styles/unistyles';

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
 */
export function PnlHeatmapCard({ ctx }: { ctx: ReportsMoneyContext }) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const prefs = useDisplayPrefs();
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
        <Skeleton style={styles.skeleton} />
      </DashboardCard>
    );
  }
  if (trades.error || heatmap.total === 0) {
    return (
      <DashboardCard title={t`P&L heatmap`}>
        <Text style={styles.empty}>
          {trades.error ? t`Failed to load trades.` : t`No trades in this range.`}
        </Text>
      </DashboardCard>
    );
  }

  const hours = Array.from(
    { length: heatmap.hourEnd - heatmap.hourStart + 1 },
    (_, i) => heatmap.hourStart + i,
  );

  return (
    <DashboardCard title={t`P&L heatmap`}>
      <View style={styles.gridRow}>
        <View style={styles.dayCol} />
        {hours.map((hour) => (
          <Text key={hour} style={styles.hourLabel} numberOfLines={1}>
            {hour}
          </Text>
        ))}
      </View>
      {heatmap.days.map((day) => (
        <View key={day} style={styles.gridRow}>
          <Text style={[styles.dayCol, styles.dayLabel]}>{heatmapDayLabel(day)}</Text>
          {hours.map((hour) => {
            const cell = heatmap.grid[day][hour];
            const label = `${heatmapDayLabel(day)} ${formatHourKeyLabel(`${String(hour).padStart(2, '0')}:00`)}`;
            return (
              <Pressable
                key={hour}
                disabled={cell.trades === 0}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/(reports)/heatmap-cell',
                    params: { day: String(day), hour: String(hour) },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={
                  cell.trades > 0
                    ? t`${label} — ${money.format(cell.pnl)} · ${cell.trades} trades`
                    : t`${label} — no trades`
                }
                style={({ pressed }) => [
                  styles.cell,
                  cell.trades > 0 && {
                    backgroundColor: pnlBgTint(theme.colors, cell.pnl, heatmap.maxAbsPnl),
                  },
                  pressed && styles.cellPressed,
                ]}
              />
            );
          })}
        </View>
      ))}
      <Text style={styles.caption}>
        {t`Closed-trade P&L by entry time on the market clock. Tap a cell for its trades.`}
      </Text>
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  gridRow: { flexDirection: 'row', gap: 2, marginBottom: 2, alignItems: 'center' },
  dayCol: { width: 34 },
  dayLabel: { fontSize: 11, fontWeight: '500', color: theme.colors.mutedForeground },
  hourLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 8,
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 3,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  cellPressed: {
    borderWidth: 1.5,
    borderColor: theme.colors.foreground,
  },
  caption: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.sm,
    ...theme.numeric,
  },
  empty: { fontSize: 13, color: theme.colors.mutedForeground, paddingVertical: theme.spacing.lg },
  skeleton: { height: 220, borderRadius: theme.radius.lg },
}));
