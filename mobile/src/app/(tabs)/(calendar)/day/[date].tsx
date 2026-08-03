import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useAccounts, useDaily, useTrades } from '@/api/hooks';
import { SwipeableTradeRow } from '@/components/swipeable-trade-row';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { tradeDayKey } from '@/lib/calendar';
import { formatPnl } from '@/lib/format';
import { pnlColor } from '@/styles/unistyles';

/** Day-detail form sheet: net P&L header over the day's closed trades. */
export default function CalendarDayScreen() {
  const { theme } = useUnistyles();
  const { date } = useLocalSearchParams<{ date: string }>();
  const year = Number(date?.slice(0, 4));

  // Same ranges as the calendar screen so both screens share the cached queries.
  const daily = useDaily({
    from: `${year}-01-01T00:00:00Z`,
    to: `${year + 1}-01-01T00:00:00Z`,
  });
  const trades = useTrades();
  const accounts = useAccounts();
  const currency = accounts.data?.[0]?.base_currency ?? 'USD';

  const dayTrades = useMemo(
    () => (trades.data ?? []).filter((tr) => tradeDayKey(tr) === date),
    [date, trades.data],
  );
  const pnl = daily.data?.[date ?? ''] ?? 0;
  const label = date
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : '';

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{label}</Text>
        <Text style={[styles.net, { color: pnlColor(theme.colors, pnl) }]}>
          {formatPnl(pnl, currency)}
        </Text>
      </View>
      {dayTrades.length === 0 ? (
        <Text style={styles.empty}>{t`No closed trades on this day.`}</Text>
      ) : (
        dayTrades.map((trade) => (
          <SwipeableTradeRow key={trade.id} trade={trade} showDate={false} />
        ))
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
    paddingBottom: theme.spacing.sm,
  },
  title: { fontSize: 17, fontWeight: '600', color: theme.colors.foreground },
  net: { fontSize: 17, fontWeight: '600', ...theme.numeric },
  empty: { fontSize: 13, color: theme.colors.mutedForeground, paddingHorizontal: theme.spacing.xs },
}));
