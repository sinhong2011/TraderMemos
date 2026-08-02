import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { DailyPnl } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { monthGrid } from '@/lib/calendar';
import { formatPnlCompact } from '@/lib/format';
import { pnlBgTint, pnlColor } from '@/styles/unistyles';

/** Sun-first narrow weekday letters in the app locale (avoids S/T msgid collisions). */
const DOW = (() => {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2023, 0, 1 + i))));
})();

/** This-month P&L heatmap, ported from the web dashboard's mini calendar. */
export function MiniCalendarCard({
  year,
  month,
  dailyPnl,
  currency,
  onOpenCalendar,
}: {
  year: number;
  /** 1-based. */
  month: number;
  dailyPnl: DailyPnl;
  currency: string;
  onOpenCalendar?: () => void;
}) {
  const { theme } = useUnistyles();
  const grid = monthGrid(year, month, dailyPnl);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <DashboardCard
      title={t`Month`}
      action={onOpenCalendar ? { label: t`Full calendar`, onPress: onOpenCalendar } : undefined}
    >
      <Text style={styles.monthLabel}>{monthLabel}</Text>

      <View>
        <View style={styles.week}>
          {DOW.map((d, i) => (
            <Text key={`${d}-${i}`} style={styles.dowLabel}>
              {d}
            </Text>
          ))}
        </View>
        {grid.weeks.map((week, wi) => (
          <View key={wi} style={styles.week}>
            {week.map((cell, ci) => {
              if (!cell) return <View key={`empty-${ci}`} style={styles.cell} />;
              const isToday = cell.date === today;
              const hasPnl = cell.pnl != null;
              return (
                <View
                  key={cell.date}
                  style={[
                    styles.cell,
                    hasPnl && {
                      backgroundColor: pnlBgTint(theme.colors, cell.pnl!, grid.maxAbs),
                    },
                    isToday && !hasPnl && styles.todayCell,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      isToday && { color: theme.colors.accent, fontWeight: '600' },
                    ]}
                  >
                    {Number(cell.date.slice(8, 10))}
                  </Text>
                  {hasPnl ? (
                    <Text
                      style={[styles.dayPnl, { color: pnlColor(theme.colors, cell.pnl) }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {formatPnlCompact(cell.pnl, currency)}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <Text style={styles.total}>
        {t`Total`}{' '}
        <Text style={[styles.totalValue, { color: pnlColor(theme.colors, grid.monthTotal) }]}>
          {formatPnlCompact(grid.monthTotal, currency)}
        </Text>
      </Text>
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  monthLabel: { fontSize: 15, fontWeight: '500', color: theme.colors.foreground },
  week: { flexDirection: 'row', gap: 2, marginBottom: 2 },
  dowLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '500',
    color: theme.colors.mutedForeground,
    paddingVertical: 2,
  },
  cell: {
    flex: 1,
    minHeight: 42,
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 1,
  },
  todayCell: { backgroundColor: theme.colors.muted },
  dayNum: { fontSize: 11, color: theme.colors.mutedForeground, ...theme.numeric },
  dayPnl: { fontSize: 9, fontWeight: '500', ...theme.numeric },
  total: { textAlign: 'center', fontSize: 12, color: theme.colors.mutedForeground },
  totalValue: { fontWeight: '600', ...theme.numeric },
}));
