import { ContentUnavailableView, Host } from '@expo/ui/swift-ui';
import { Stack } from 'expo-router/stack';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useAccounts, useTrades } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { useSelectedAccountId } from '@/lib/account-store';
import { formatPnl } from '@/lib/format';
import { useMoneyFx } from '@/lib/money';
import { computePnlHeatmap, HEATMAP_DAY_LABELS } from '@/lib/pnl-heatmap';
import {
  accountBaseCurrency,
  formatHourKeyLabel,
  resolveMarketTimezone,
  useDisplayPrefs,
} from '@/lib/prefs';
import { pnlBgTint, pnlColor } from '@/styles/unistyles';

function dayLabel(day: number): string {
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
 * All-time weekday × hour P&L grid on the market clock. Tapping a cell shows
 * its numbers in a caption row — a phone can't fit hover tooltips.
 */
export default function HeatmapScreen() {
  const { theme } = useUnistyles();
  const prefs = useDisplayPrefs();
  const marketTz = resolveMarketTimezone(prefs.marketTimezone);
  const selectedAccountId = useSelectedAccountId();
  // All-time on purpose — the pattern needs history, not a date range.
  const trades = useTrades(selectedAccountId ? { account_id: selectedAccountId } : {});
  const accounts = useAccounts();
  const fx = useMoneyFx(accountBaseCurrency(accounts.data, selectedAccountId));
  const fxRate = fx.rate ?? 1;

  const [selected, setSelected] = useState<{ day: number; hour: number } | null>(null);

  const heatmap = useMemo(
    () => computePnlHeatmap(trades.data ?? [], marketTz),
    [trades.data, marketTz],
  );

  const hours = Array.from(
    { length: heatmap.hourEnd - heatmap.hourStart + 1 },
    (_, i) => heatmap.hourStart + i,
  );
  const selectedCell = selected ? heatmap.grid[selected.day][selected.hour] : null;

  return (
    <>
      <Stack.Screen options={{ title: t`P&L heatmap`, headerLargeTitle: false }} />
      <ScrollView
        style={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={trades.isRefetching}
            onRefresh={() => void trades.refetch()}
          />
        }
      >
        {trades.isLoading ? (
          <Skeleton style={styles.skeleton} />
        ) : heatmap.total === 0 ? (
          <Host style={styles.emptyHost}>
            <ContentUnavailableView
              title={t`No closed trades yet`}
              systemImage="square.grid.3x3"
              description={t`The grid fills in as closed trades accumulate.`}
            />
          </Host>
        ) : (
          <DashboardCard title={t`Entry hour × weekday`}>
            {/* Hour header */}
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
                <Text style={[styles.dayCol, styles.dayLabel]}>{dayLabel(day)}</Text>
                {hours.map((hour) => {
                  const cell = heatmap.grid[day][hour];
                  const active = selected?.day === day && selected?.hour === hour;
                  return (
                    <Pressable
                      key={hour}
                      onPress={() =>
                        setSelected(cell.trades > 0 ? { day, hour } : null)
                      }
                      accessibilityLabel={t`${dayLabel(day)} ${formatHourKeyLabel(`${String(hour).padStart(2, '0')}:00`)} — ${cell.trades} trades`}
                      style={[
                        styles.cell,
                        cell.trades > 0 && {
                          backgroundColor: pnlBgTint(theme.colors, cell.pnl, heatmap.maxAbsPnl),
                        },
                        active && styles.cellActive,
                      ]}
                    />
                  );
                })}
              </View>
            ))}

            {selected && selectedCell ? (
              <Text style={styles.caption}>
                {dayLabel(selected.day)}{' '}
                {formatHourKeyLabel(`${String(selected.hour).padStart(2, '0')}:00`)} ·{' '}
                {t`${selectedCell.trades} trades`} ·{' '}
                <Text style={{ color: pnlColor(theme.colors, selectedCell.pnl) }}>
                  {formatPnl(selectedCell.pnl * fxRate, fx.currency)}
                </Text>
              </Text>
            ) : (
              <Text style={styles.caption}>
                {t`Closed-trade P&L by entry time on the market clock. Tap a cell for its numbers.`}
              </Text>
            )}
          </DashboardCard>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
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
  cellActive: {
    borderWidth: 1.5,
    borderColor: theme.colors.foreground,
  },
  caption: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  skeleton: { height: 280, borderRadius: theme.radius.lg + 4 },
  emptyHost: { minHeight: 320 },
}));
