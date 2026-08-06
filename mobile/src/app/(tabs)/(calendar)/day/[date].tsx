import { Chart } from '@expo/ui/swift-ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  useAccounts,
  useBehavior,
  useCompliance,
  useNotes,
  useSummary,
  useTrades,
} from '@/api/hooks';
import type { BehaviorReport, ComplianceReport, Note, Trade } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { Pill } from '@/components/pill';
import { Skeleton } from '@/components/skeleton';
import { StatBar } from '@/components/stat-bar';
import { SwipeableTradeRow } from '@/components/swipeable-trade-row';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { useSelectedAccountId } from '@/lib/account-store';
import { dayBounds, useGlobalFilters } from '@/lib/filters';
import { formatPercent, formatPnl, formatTime } from '@/lib/format';
import { noteExcerpt } from '@/lib/markdown';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency, useDisplayPrefs } from '@/lib/prefs';
import { pnlColor } from '@/styles/unistyles';
import { AppHost } from '@/components/app-host';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Noon-anchored so a ±1 day step can't land on a DST-shortened midnight. */
function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayTitle(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Close-ordered running total of realized P&L, in display currency. */
function cumulativePnl(trades: Trade[], fxRate: number) {
  const closed = trades
    .filter((trade) => trade.closed_at != null && trade.net_pnl != null)
    .sort((a, b) => String(a.closed_at).localeCompare(String(b.closed_at)));
  let running = 0;
  return closed.map((trade, index) => {
    running += (trade.net_pnl ?? 0) * fxRate;
    return { x: index + 1, y: running, at: String(trade.closed_at) };
  });
}

/**
 * Cumulative realized P&L over the session, stepped at each close. Swift
 * Charts plots against the close index (the equity-card idiom) — clock times
 * ride along in the caption, where they stay readable at phone width.
 */
function IntradayCurve({
  trades,
  currency,
  fxRate,
}: {
  trades: Trade[];
  currency: string;
  fxRate: number;
}) {
  const { theme } = useUnistyles();
  const series = useMemo(() => cumulativePnl(trades, fxRate), [trades, fxRate]);

  if (series.length < 2) {
    return <Text style={styles.empty}>{t`Not enough closed trades to draw a session curve.`}</Text>;
  }

  const final = series[series.length - 1].y;
  const peak = series.reduce((best, point) => (point.y > best.y ? point : best), series[0]);

  return (
    <>
      <View style={styles.headline}>
        <Text selectable style={[styles.headlineValue, { color: pnlColor(theme.colors, final) }]}>
          {formatPnl(final, currency)}
        </Text>
        <Text style={styles.headlineMeta}>{t`over ${series.length} closes`}</Text>
      </View>
      <AppHost style={styles.chart}>
        <Chart
          data={series.map(({ x, y }) => ({ x, y }))}
          type="line"
          animate
          lineStyle={{ color: pnlColor(theme.colors, final), width: 2 }}
          referenceLines={[{ x: 'start', y: 0 }]}
          ruleStyle={{ color: '#80808055', lineWidth: 1, dashArray: [4, 4] }}
        />
      </AppHost>
      {peak.y > final ? (
        <Text style={styles.caption}>
          {t`Peaked at`}{' '}
          <Text style={[styles.captionValue, { color: pnlColor(theme.colors, peak.y) }]}>
            {formatPnl(peak.y, currency)}
          </Text>{' '}
          {t`around ${formatTime(peak.at)}`}
        </Text>
      ) : null}
    </>
  );
}

/** Rule-compliance and behavior flags for the day, as web's pill rows. */
function DayFlags({
  date,
  compliance,
  behavior,
}: {
  date: string;
  compliance?: ComplianceReport;
  behavior?: BehaviorReport;
}) {
  const day = compliance?.days.find((entry) => entry.date === date);
  const behaviorFlags =
    (behavior?.revenge.events.length ?? 0) +
    (behavior?.overconfidence.events.length ?? 0) +
    (behavior?.loss_aversion.give_back_count ?? 0);

  return (
    <>
      {compliance?.rules_configured ? (
        <View style={styles.pills}>
          {day == null ? (
            <Pill>{t`no closed trades scored`}</Pill>
          ) : day.compliant ? (
            <Pill tone="pos">{t`rules followed`}</Pill>
          ) : (
            <>
              {day.risk_violations > 0 ? (
                <Pill tone="neg">{t`over-risked ×${day.risk_violations}`}</Pill>
              ) : null}
              {day.daily_loss_breach ? <Pill tone="neg">{t`daily loss breached`}</Pill> : null}
            </>
          )}
          {day != null && day.unknown_risk > 0 ? (
            <Pill tone="amber">{t`${day.unknown_risk} without recorded risk`}</Pill>
          ) : null}
        </View>
      ) : null}

      {behavior != null && behaviorFlags > 0 ? (
        <View style={styles.pills}>
          {behavior.revenge.events.length > 0 ? (
            <Pill tone="amber">{t`revenge trades ×${behavior.revenge.events.length}`}</Pill>
          ) : null}
          {behavior.overconfidence.events.length > 0 ? (
            <Pill tone="amber">
              {t`oversized after streak ×${behavior.overconfidence.events.length}`}
            </Pill>
          ) : null}
          {behavior.loss_aversion.give_back_count > 0 ? (
            <Pill tone="amber">
              {t`profit given back ×${behavior.loss_aversion.give_back_count}`}
            </Pill>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

/** One journal entry for the day — title over an excerpt, tap to edit. */
function NoteRow({ note, onPress }: { note: Note; onPress: () => void }) {
  const excerpt = noteExcerpt(note.body);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.noteRow, pressed && styles.pressed]}
    >
      <Text style={styles.noteTitle} numberOfLines={1}>
        {note.title || (note.type === 'daily_log' ? t`Daily log` : t`Note`)}
      </Text>
      {excerpt ? (
        <Text style={styles.noteExcerpt} numberOfLines={2}>
          {excerpt}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * One trading day, reviewed the way the web `/day/$date` page does it: what
 * happened, was it inside the rules, and what got written down while it was
 * fresh. Pushed rather than a sheet — four cards need the whole screen — and
 * the header chevrons swap the date in place, so stepping through a week
 * never stacks a screen per day.
 */
export default function CalendarDayScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const day = date && DATE_RE.test(date) ? date : '';

  const globalFilters = useGlobalFilters();
  const filters = useMemo(
    () => (day ? { ...globalFilters, ...dayBounds(day, globalFilters.tz ?? 'UTC') } : globalFilters),
    [globalFilters, day],
  );

  const trades = useTrades(filters);
  const summary = useSummary(filters);
  const compliance = useCompliance(filters);
  const behavior = useBehavior(filters);
  // `occurred_at` is compared as a raw string server-side, so the window runs
  // to the *next* day key — bounding it at `day` would drop a log saved with a
  // time component ("2026-06-01T14:00Z" sorts after "2026-06-01"). The extra
  // day is filtered back out below.
  const notes = useNotes(day ? { from: day, to: shiftDay(day, 1) } : {});
  const accounts = useAccounts();
  const selectedAccountId = useSelectedAccountId();
  const fx = useMoneyFx(accountBaseCurrency(accounts.data, selectedAccountId));
  const currency = fx.currency;
  const fxRate = fx.rate ?? 1;
  // Re-render when privacy mode flips — every card formats money.
  useDisplayPrefs();

  const dayTrades = trades.data ?? [];
  const netPnl = (summary.data?.net_pnl ?? 0) * fxRate;
  const fees = (summary.data?.total_fees ?? 0) * fxRate;
  const totalTrades = summary.data?.total_trades ?? 0;
  // Daily logs win when the day has any; plain notes only show when they're
  // all there is (web's dayNotes fallback).
  const dayNotes = useMemo(() => {
    const all = (notes.data ?? []).filter((note) => note.occurred_at.slice(0, 10) === day);
    const logs = all.filter((note) => note.type === 'daily_log');
    return logs.length > 0 ? logs : all;
  }, [notes.data, day]);

  /** Swap the date in place rather than pushing a screen per day. */
  const stepDay = (days: number) => router.setParams({ date: shiftDay(day, days) });

  return (
    <>
      <Stack.Screen
        options={{
          title: day ? dayTitle(day) : t`Day`,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable
                onPress={() => stepDay(-1)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t`Previous day`}
                style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
              >
                <SymbolView name="chevron.left" size={15} tintColor={theme.colors.foreground} />
              </Pressable>
              <Pressable
                onPress={() => stepDay(1)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t`Next day`}
                style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
              >
                <SymbolView name="chevron.right" size={15} tintColor={theme.colors.foreground} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={trades.isRefetching || summary.isRefetching}
            onRefresh={() =>
              void Promise.all([
                trades.refetch(),
                summary.refetch(),
                compliance.refetch(),
                behavior.refetch(),
                notes.refetch(),
              ])
            }
          />
        }
      >
        <DashboardCard title={t`Session summary`} flush>
          {summary.isLoading ? (
            <Skeleton style={styles.statsSkeleton} />
          ) : (
            <>
              <View style={styles.grid}>
                <StatBar
                  label={t`Net P&L`}
                  value={formatPnl(netPnl, currency)}
                  tone={netPnl >= 0 ? 'pos' : 'neg'}
                />
                <StatBar label={t`Trades`} value={String(totalTrades)} />
                <StatBar
                  label={t`Win rate`}
                  value={totalTrades > 0 ? formatPercent(summary.data?.win_rate, 0) : t`No trades`}
                  sub={
                    totalTrades > 0
                      ? t`${summary.data?.wins ?? 0}W · ${summary.data?.losses ?? 0}L`
                      : undefined
                  }
                />
                <StatBar
                  label={t`Fees`}
                  value={formatPnl(-fees, currency)}
                  tone={fees > 0 ? 'neg' : 'muted'}
                />
              </View>
              <DayFlags date={day} compliance={compliance.data} behavior={behavior.data} />
            </>
          )}
        </DashboardCard>

        <DashboardCard title={t`Intraday P&L`}>
          {trades.isLoading ? (
            <Skeleton style={styles.chart} />
          ) : (
            <IntradayCurve trades={dayTrades} currency={currency} fxRate={fxRate} />
          )}
        </DashboardCard>

        <DashboardCard title={t`Trades`}>
          {trades.isLoading ? (
            <Skeleton style={styles.listSkeleton} />
          ) : trades.isError ? (
            <Text style={styles.error}>{t`Could not load this day's trades.`}</Text>
          ) : dayTrades.length === 0 ? (
            <Text style={styles.empty}>{t`No trades on this day.`}</Text>
          ) : (
            <View style={styles.rows}>
              {dayTrades.map((trade) => (
                <SwipeableTradeRow key={trade.id} trade={trade} showDate={false} />
              ))}
            </View>
          )}
        </DashboardCard>

        <DashboardCard
          title={t`Daily log`}
          action={{
            label: t`New`,
            onPress: () =>
              router.push({ pathname: '/new-note', params: { date: day, type: 'daily_log' } }),
          }}
        >
          {notes.isLoading ? (
            <Skeleton style={styles.notesSkeleton} />
          ) : dayNotes.length === 0 ? (
            <Text style={styles.empty}>
              {t`Nothing journaled for this day yet. A two-minute recap while it's fresh beats a perfect writeup never written.`}
            </Text>
          ) : (
            <View style={styles.rows}>
              {dayNotes.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  onPress={() => router.push({ pathname: '/edit-note', params: { id: note.id } })}
                />
              ))}
            </View>
          )}
        </DashboardCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 2,
  },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  headerButton: { padding: theme.spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.xs },
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm },
  headlineValue: { fontSize: 22, fontWeight: '600', ...theme.numeric },
  headlineMeta: { fontSize: 13, color: theme.colors.mutedForeground },
  chart: { height: 190 },
  caption: { fontSize: 12, color: theme.colors.mutedForeground },
  captionValue: { fontWeight: '500', ...theme.numeric },
  rows: { gap: theme.spacing.sm },
  noteRow: {
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  noteTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.foreground },
  noteExcerpt: { fontSize: 12, lineHeight: 17, color: theme.colors.mutedForeground },
  pressed: { opacity: 0.6 },
  statsSkeleton: { height: 200, borderRadius: theme.radius.lg },
  listSkeleton: { height: 160, borderRadius: theme.radius.lg },
  notesSkeleton: { height: 72, borderRadius: theme.radius.lg },
  empty: { fontSize: 13, lineHeight: 19, color: theme.colors.mutedForeground },
  error: { fontSize: 13, color: theme.colors.destructive },
}));
