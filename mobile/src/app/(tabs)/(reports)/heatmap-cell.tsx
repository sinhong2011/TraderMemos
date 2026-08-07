import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useTrades } from '@/api/hooks';
import { InlineError } from '@/components/error-state';
import { heatmapDayLabel } from '@/components/reports/pnl-heatmap-card';
import { useReportsFilters, useReportsMoney } from '@/components/reports/section-scaffold';
import { SwipeableTradeRow } from '@/components/swipeable-trade-row';
import { t } from '@lingui/core/macro';
import { formatPercent, useFormatters } from '@/lib/format';
import { computePnlHeatmap } from '@/lib/pnl-heatmap';
import { resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';
import { pnlColor } from '@/styles/unistyles';

/**
 * Heatmap cell-details form sheet: the cell's numbers over its trades.
 * Recomputes from the same Reports-filtered trades query as the card, so
 * the sheet stays consistent with the grid (and the query is already cached).
 */
export default function HeatmapCellScreen() {
  const { theme } = useUnistyles();
  const params = useLocalSearchParams<{ day: string; hour: string }>();
  const day = Number(params.day);
  const hour = Number(params.hour);

  const prefs = useDisplayPrefs();
  const { formatHourKeyLabel } = useFormatters();
  const marketTz = resolveMarketTimezone(prefs.marketTimezone);
  const filters = useReportsFilters();
  const trades = useTrades(filters);
  const { money } = useReportsMoney();

  const gross = money.pnlMode === 'gross';
  const heatmap = useMemo(
    () =>
      computePnlHeatmap(
        trades.data ?? [],
        marketTz,
        gross ? (tr) => tr.gross_pnl ?? tr.net_pnl ?? 0 : undefined,
      ),
    [trades.data, marketTz, gross],
  );

  const valid = Number.isInteger(day) && day >= 0 && day < 7 && Number.isInteger(hour) && hour >= 0 && hour < 24;
  const cell = valid ? heatmap.grid[day][hour] : null;
  const items = useMemo(
    () => [...(cell?.items ?? [])].sort((a, b) => b.opened_at.localeCompare(a.opened_at)),
    [cell],
  );
  const wins = items.filter((tr) => money.tradePnl(tr) > 0).length;
  const losses = items.filter((tr) => money.tradePnl(tr) < 0).length;

  const hourKey = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  const title = valid
    ? `${heatmapDayLabel(day)} · ${formatHourKeyLabel(hourKey(hour))}–${formatHourKeyLabel(hourKey(hour + 1))}`
    : '';

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {cell ? (
          <Text style={[styles.net, { color: pnlColor(theme.colors, cell.pnl) }]}>
            {money.format(cell.pnl)}
          </Text>
        ) : null}
      </View>
      {cell && cell.trades > 0 ? (
        <Text style={styles.meta}>
          {t`${wins} wins · ${losses} losses`} ·{' '}
          {formatPercent(cell.trades > 0 ? wins / cell.trades : 0, 0)} ·{' '}
          {t`entries on the market clock`}
        </Text>
      ) : null}
      {trades.error && trades.data == null ? (
        // The grid behind this sheet is drawn from the same query, so a failure
        // with nothing cached would otherwise claim the tapped cell is empty.
        <InlineError error={trades.error} onRetry={() => void trades.refetch()} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>{t`No closed trades in this hour.`}</Text>
      ) : (
        items.map((trade) => <SwipeableTradeRow key={trade.id} trade={trade} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xl * 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.md,
  },
  title: { fontSize: 17, fontWeight: '600', color: theme.colors.foreground },
  net: { fontSize: 17, fontWeight: '600', ...theme.numeric },
  meta: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    paddingHorizontal: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
    ...theme.numeric,
  },
  empty: { fontSize: 13, color: theme.colors.mutedForeground, paddingHorizontal: theme.spacing.xs },
}));
