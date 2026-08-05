import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  useAccounts,
  useBehavior,
  useCompliance,
  useNotes,
  useSummary,
  useTrades,
} from '@/api/hooks';
import type { Note } from '@/api/types';
import { IntradayCard } from '@/components/day-review/intraday-card';
import { LogCard } from '@/components/day-review/log-card';
import { SessionCard } from '@/components/day-review/session-card';
import { MicroHeading } from '@/components/reports/shared';
import { Skeleton } from '@/components/skeleton';
import { SwipeableTradeRow } from '@/components/swipeable-trade-row';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { useSelectedAccountId } from '@/lib/account-store';
import { dayBounds, isDayKey, shiftDay } from '@/lib/day-review';
import { useGlobalFilters } from '@/lib/filters';
import { formatPnl } from '@/lib/format';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency, resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';
import { pnlColor } from '@/styles/unistyles';

function dayTitle(date: string): string {
  // Noon-anchored so the label can't slip a day on either side of UTC.
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Chevron that steps the review to the neighbouring day, in place. */
function StepButton({
  direction,
  label,
  onPress,
}: {
  direction: 'left' | 'right';
  label: string;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.step, pressed && styles.pressed]}
    >
      <SymbolView name={`chevron.${direction}`} size={15} tintColor={theme.colors.foreground} />
    </Pressable>
  );
}

/**
 * Day review: one trading day read the way pros read it — what the session did,
 * how it got there, whether it stayed inside the rules, and what you wrote down
 * while it was fresh. Opens as a form sheet from any day cell (calendar grid,
 * compliance breach rows) and steps day to day without closing.
 */
export default function DayReviewScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  // Re-render when privacy mode flips — the header formats money.
  useDisplayPrefs();
  const valid = isDayKey(date);

  const globalFilters = useGlobalFilters();
  // Bounds come off the market clock, so the API buckets the same day the
  // calendar drew (a New York day is not a UTC day).
  const dayFilters = useMemo(
    () =>
      valid
        ? {
            ...globalFilters,
            ...dayBounds(date, globalFilters.tz ?? resolveMarketTimezone()),
          }
        : {},
    [valid, date, globalFilters],
  );

  const trades = useTrades(dayFilters);
  const summary = useSummary(dayFilters);
  const compliance = useCompliance(dayFilters);
  const behavior = useBehavior(dayFilters);
  // `occurred_at` is stored as the client wrote it — a bare "YYYY-MM-DD" for
  // notes filed from the form — and the endpoint compares it as a string, so
  // the range starts at the plain day key, which sorts before any timestamped
  // variant of the same date.
  const notes = useNotes(valid ? { from: date, to: `${date}T23:59:59Z` } : {});

  const accounts = useAccounts();
  const selectedAccountId = useSelectedAccountId();
  const fx = useMoneyFx(accountBaseCurrency(accounts.data, selectedAccountId));
  const currency = fx.currency;
  const fxRate = fx.rate ?? 1;

  const dayNotes = useMemo(
    () => (notes.data ?? []).filter((note) => note.occurred_at.slice(0, 10) === date),
    [notes.data, date],
  );

  if (!valid) {
    return (
      <View style={styles.page}>
        <Text style={styles.empty}>{t`That day could not be read.`}</Text>
      </View>
    );
  }

  const dayTrades = trades.data ?? [];
  const netPnl = (summary.data?.net_pnl ?? 0) * fxRate;
  const openNote = (note: Note) => router.push({ pathname: '/edit-note', params: { id: note.id } });
  const newLog = () => router.push({ pathname: '/new-note', params: { date, type: 'daily_log' } });

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {dayTitle(date)}
          </Text>
          <Text style={[styles.net, { color: pnlColor(theme.colors, netPnl) }]}>
            {formatPnl(netPnl, currency)}
          </Text>
        </View>
        <View style={styles.steps}>
          <StepButton
            direction="left"
            label={t`Previous day`}
            onPress={() => router.setParams({ date: shiftDay(date, -1) })}
          />
          <StepButton
            direction="right"
            label={t`Next day`}
            onPress={() => router.setParams({ date: shiftDay(date, 1) })}
          />
        </View>
      </View>

      <SessionCard
        date={date}
        summary={summary.data}
        loading={summary.isLoading}
        compliance={compliance.data}
        behavior={behavior.data}
        currency={currency}
        fxRate={fxRate}
      />

      <IntradayCard
        trades={dayTrades}
        loading={trades.isLoading}
        currency={currency}
        fxRate={fxRate}
      />

      <View style={styles.trades}>
        <MicroHeading>{t`Trades`}</MicroHeading>
        {trades.isLoading ? (
          <Skeleton style={styles.rowsSkeleton} />
        ) : trades.error ? (
          <Text style={styles.empty}>{t`Failed to load trades.`}</Text>
        ) : dayTrades.length === 0 ? (
          <Text style={styles.empty}>{t`No closed trades on this day.`}</Text>
        ) : (
          dayTrades.map((trade) => (
            <SwipeableTradeRow key={trade.id} trade={trade} showDate={false} />
          ))
        )}
      </View>

      <LogCard
        notes={dayNotes}
        loading={notes.isLoading}
        onOpenNote={openNote}
        onNewLog={newLog}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
  },
  headerText: { flexShrink: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '600', color: theme.colors.foreground },
  net: { fontSize: 22, fontWeight: '600', ...theme.numeric },
  steps: { flexDirection: 'row', gap: theme.spacing.xs },
  step: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: theme.colors.muted,
  },
  pressed: { opacity: 0.6 },
  trades: { gap: theme.spacing.xs, paddingHorizontal: theme.spacing.xs },
  rowsSkeleton: { height: 160 },
  empty: { fontSize: 13, color: theme.colors.mutedForeground, paddingHorizontal: theme.spacing.xs },
}));
