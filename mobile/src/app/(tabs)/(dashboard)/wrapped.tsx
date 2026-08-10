// See the note in trade-form.tsx / reports.tsx: @expo/ui's SwiftUI pager
// swallows taps on RN views inside its pages, so year paging rides
// react-native-pager-view.
import PagerView from 'react-native-pager-view';
import { ContentUnavailableView } from '@expo/ui/swift-ui';
import { Stack } from 'expo-router/stack';
import { useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useAccounts, useTrades } from '@/api/hooks';
import { AppHost } from '@/components/app-host';
import { DashboardCard } from '@/components/dashboard-card';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { StatBar } from '@/components/stat-bar';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { useSelectedAccountId } from '@/lib/account-store';
import { formatDuration, formatPercent, formatRatio, useFormatters } from '@/lib/format';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency } from '@/lib/prefs';
import { computeYearWrapped } from '@/lib/wrapped';
import { pnlColor } from '@/styles/unistyles';

const MIN_YEAR = 2000;

function yearsRange(currentYear: number): number[] {
  const years: number[] = [];
  for (let y = MIN_YEAR; y <= currentYear; y++) years.push(y);
  return years;
}

function monthShort(month: number): string {
  return new Date(Date.UTC(2024, month, 1)).toLocaleDateString(locale, {
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Compact year chrome above the pager — centered year with carousel peeks for
 * neighbors and a sliding window of page dots. No boxed bar; swipe is primary.
 */
function YearIndicator({
  years,
  index,
  currentYear,
  onSelect,
}: {
  years: number[];
  index: number;
  currentYear: number;
  onSelect: (index: number) => void;
}) {
  const year = years[index]!;
  const prev = index > 0 ? years[index - 1] : null;
  const next = index < years.length - 1 ? years[index + 1] : null;
  const inProgress = year === currentYear;

  // Sliding window of at most 7 dots so a 2000→now range doesn't paint a grid.
  const windowSize = Math.min(7, years.length);
  const windowStart = Math.max(
    0,
    Math.min(index - Math.floor(windowSize / 2), years.length - windowSize),
  );

  return (
    <View style={styles.indicator}>
      <View style={styles.indicatorRow}>
        <Pressable
          onPress={() => prev != null && onSelect(index - 1)}
          disabled={prev == null}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t`Previous year`}
          style={({ pressed }) => [
            styles.sideYear,
            prev == null && styles.sideYearHidden,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.sideYearLabel}>{prev ?? ' '}</Text>
        </Pressable>
        <Text style={styles.yearLabel} accessibilityRole="header">
          {year}
          {inProgress ? <Text style={styles.inProgress}> · {t`in progress`}</Text> : null}
        </Text>
        <Pressable
          onPress={() => next != null && onSelect(index + 1)}
          disabled={next == null}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t`Next year`}
          style={({ pressed }) => [
            styles.sideYear,
            next == null && styles.sideYearHidden,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.sideYearLabel}>{next ?? ' '}</Text>
        </Pressable>
      </View>
      {years.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden>
          {Array.from({ length: windowSize }, (_, i) => {
            const pageIndex = windowStart + i;
            const active = pageIndex === index;
            return (
              <Pressable
                key={years[pageIndex]}
                onPress={() => onSelect(pageIndex)}
                hitSlop={6}
                style={[styles.dot, active && styles.dotActive]}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** One year's recap — own query + scroll so the pager can keep pages independent. */
function WrappedYear({ year, active }: { year: number; active: boolean }) {
  const { theme } = useUnistyles();
  const selectedAccountId = useSelectedAccountId();
  // Far pages stay mounted for swipe physics but skip the network until nearby.
  const trades = useTrades(
    {
      ...(selectedAccountId ? { account_id: selectedAccountId } : {}),
      from: `${year}-01-01T00:00:00Z`,
      to: `${year + 1}-01-01T00:00:00Z`,
    },
    { enabled: active },
  );
  const accounts = useAccounts();
  const fx = useMoneyFx(accountBaseCurrency(accounts.data, selectedAccountId));
  const currency = fx.currency;
  const rate = fx.rate ?? 1;
  const { formatPnl, formatPnlCompact } = useFormatters();

  const wrapped = useMemo(() => computeYearWrapped(trades.data ?? [], year), [trades.data, year]);
  const money = (v: number) => formatPnl(v * rate, currency);
  const moneyCompact = (v: number) => formatPnlCompact(v * rate, currency);
  const maxMonthTrades = Math.max(...wrapped.months.map((m) => m.trades), 1);

  return (
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
      {trades.isLoading || (!active && trades.data == null) ? (
        <>
          <Skeleton style={styles.skeletonTall} />
          <Skeleton style={styles.skeletonCard} />
        </>
      ) : trades.error && trades.data == null ? (
        // The recap is computed from the trades, so a failed fetch with no
        // cache produces a zeroed wrapped — indistinguishable from a year you
        // didn't trade. Cached trades still recap fine.
        <View style={styles.emptyHost}>
          <ErrorState
            error={trades.error}
            onRetry={() => void trades.refetch()}
            retrying={trades.isRefetching}
          />
        </View>
      ) : wrapped.totalTrades === 0 ? (
        <AppHost style={styles.emptyHost}>
          <ContentUnavailableView
            title={t`No closed trades in ${year}`}
            systemImage="sparkles"
            description={t`The recap appears once the year has closed trades.`}
          />
        </AppHost>
      ) : (
        <>
          <DashboardCard title={t`${year} in one number`}>
            <View style={styles.hero}>
              <Text
                selectable
                style={[styles.heroValue, { color: pnlColor(theme.colors, wrapped.netPnl) }]}
              >
                {money(wrapped.netPnl)}
              </Text>
              <Text style={styles.heroCaption}>
                {t`${wrapped.totalTrades} closed trades · ${formatPercent(wrapped.winRate, 0)} win rate · ${wrapped.tradingDays} trading days`}
              </Text>
            </View>
          </DashboardCard>

          <DashboardCard title={t`Your highs`} flush>
            <View style={styles.grid}>
              <StatBar
                label={t`Best day`}
                value={wrapped.bestDay ? moneyCompact(wrapped.bestDay.pnl) : moneyCompact(0)}
                sub={wrapped.bestDay?.date}
                tone="pos"
              />
              <StatBar
                label={t`Biggest win`}
                value={wrapped.biggestWin ? moneyCompact(wrapped.biggestWin.pnl) : moneyCompact(0)}
                sub={wrapped.biggestWin?.symbol}
                tone="pos"
              />
              <StatBar
                label={t`Longest win streak`}
                value={String(wrapped.bestStreak)}
                sub={t`wins in a row`}
                tone="pos"
              />
              <StatBar
                label={t`Green days`}
                value={String(wrapped.greenDays)}
                sub={t`of ${wrapped.tradingDays}`}
                tone="pos"
              />
            </View>
          </DashboardCard>

          <DashboardCard title={t`Your lows`} flush>
            <View style={styles.grid}>
              <StatBar
                label={t`Worst day`}
                value={wrapped.worstDay ? moneyCompact(wrapped.worstDay.pnl) : moneyCompact(0)}
                sub={wrapped.worstDay?.date}
                tone="neg"
              />
              <StatBar
                label={t`Biggest loss`}
                value={
                  wrapped.biggestLoss ? moneyCompact(wrapped.biggestLoss.pnl) : moneyCompact(0)
                }
                sub={wrapped.biggestLoss?.symbol}
                tone="neg"
              />
              <StatBar
                label={t`Longest loss streak`}
                value={String(wrapped.worstStreak)}
                sub={t`losses in a row`}
                tone="neg"
              />
              <StatBar
                label={t`Red days`}
                value={String(wrapped.redDays)}
                sub={t`of ${wrapped.tradingDays}`}
                tone="neg"
              />
              <StatBar
                label={t`Most-tagged mistake`}
                value={wrapped.mainMistake ?? t`None tagged`}
                tone={wrapped.mainMistake ? 'neg' : 'muted'}
              />
            </View>
          </DashboardCard>

          <DashboardCard title={t`Your rhythm`}>
            <View style={styles.months}>
              {wrapped.months.map((month) => (
                <View key={month.month} style={styles.monthCol}>
                  <View style={styles.monthTrack}>
                    <View
                      style={[
                        styles.monthFill,
                        {
                          height: `${Math.max(4, (month.trades / maxMonthTrades) * 100)}%`,
                          backgroundColor:
                            month.trades === 0
                              ? theme.colors.muted
                              : pnlColor(theme.colors, month.pnl),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.monthLabel}>{monthShort(month.month)}</Text>
                </View>
              ))}
            </View>
            {wrapped.busiestMonth ? (
              <Text style={styles.caption}>
                {t`Busiest month: ${monthShort(wrapped.busiestMonth.month)} with ${wrapped.busiestMonth.trades} trades.`}
              </Text>
            ) : null}
          </DashboardCard>

          <DashboardCard title={t`Your habits`} flush>
            <View style={styles.grid}>
              {wrapped.topSymbols.map((symbol, index) => (
                <StatBar
                  key={symbol.symbol}
                  label={index === 0 ? t`Most traded` : t`#${index + 1}`}
                  value={symbol.symbol}
                  sub={`${symbol.trades} · ${moneyCompact(symbol.pnl)}`}
                  tone={index === 0 ? 'accent' : 'muted'}
                />
              ))}
              <StatBar
                label={t`Time in the market`}
                value={formatDuration(wrapped.totalHoldSecs)}
              />
              <StatBar label={t`Average hold`} value={formatDuration(wrapped.avgHoldSecs)} />
            </View>
          </DashboardCard>

          <DashboardCard title={t`Bottom line`} flush>
            <View style={styles.grid}>
              <StatBar
                label={t`Profit factor`}
                value={formatRatio(wrapped.profitFactor)}
                tone={wrapped.profitFactor >= 1 ? 'pos' : 'neg'}
              />
              <StatBar
                label={t`Expectancy`}
                value={moneyCompact(wrapped.expectancy)}
                sub={t`per trade`}
                tone={wrapped.expectancy >= 0 ? 'pos' : 'neg'}
              />
              <StatBar
                label={t`Fees paid`}
                value={moneyCompact(-wrapped.totalFees)}
                tone="neg"
              />
            </View>
          </DashboardCard>
        </>
      )}
    </ScrollView>
  );
}

/** Annual recap — swipeable years, one page each from MIN_YEAR to now. */
export default function WrappedScreen() {
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => yearsRange(currentYear), [currentYear]);
  const initialIndex = years.length - 1;
  const [index, setIndex] = useState(initialIndex);
  const pagerRef = useRef<PagerView>(null);

  const selectIndex = (next: number) => {
    const clamped = Math.max(0, Math.min(years.length - 1, next));
    setIndex(clamped);
    pagerRef.current?.setPage(clamped);
  };

  return (
    <>
      <Stack.Screen options={{ title: t`Year Wrapped`, headerLargeTitle: false }} />
      <View style={styles.root}>
        <YearIndicator
          years={years}
          index={index}
          currentYear={currentYear}
          onSelect={selectIndex}
        />
        <PagerView
          ref={pagerRef}
          initialPage={initialIndex}
          style={styles.pager}
          onPageSelected={(event) => setIndex(event.nativeEvent.position)}
        >
          {years.map((year, pageIndex) => (
            <View key={year} style={styles.fill} collapsable={false}>
              <WrappedYear year={year} active={Math.abs(pageIndex - index) <= 1} />
            </View>
          ))}
        </PagerView>
      </View>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  pager: { flex: 1 },
  fill: { flex: 1 },
  page: { backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  indicator: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideYear: {
    minWidth: 56,
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  sideYearHidden: { opacity: 0 },
  sideYearLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
  yearLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.foreground,
    textAlign: 'center',
    ...theme.numeric,
  },
  inProgress: { fontSize: 13, fontWeight: '400', color: theme.colors.mutedForeground },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  // Capsule chip dots — trade-form pager language, without a bordered track.
  dot: {
    width: 6,
    height: 6,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  dotActive: {
    width: 14,
    backgroundColor: theme.colors.foreground,
  },
  pressed: { opacity: 0.6 },
  hero: { alignItems: 'center', gap: theme.spacing.xs, paddingVertical: theme.spacing.sm },
  heroValue: { fontSize: 34, fontWeight: '600', letterSpacing: -1, ...theme.numeric },
  heroCaption: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  months: { flexDirection: 'row', gap: theme.spacing.xs, height: 96, alignItems: 'flex-end' },
  monthCol: { flex: 1, alignItems: 'center', gap: 3, height: '100%' },
  monthTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  monthFill: { width: '100%', borderRadius: 3, borderCurve: 'continuous' },
  monthLabel: { fontSize: 8, color: theme.colors.mutedForeground },
  caption: { fontSize: 12, color: theme.colors.mutedForeground },
  skeletonTall: { height: 180, borderRadius: theme.radius.lg + 4 },
  skeletonCard: { height: 200, borderRadius: theme.radius.lg + 4 },
  emptyHost: { minHeight: 320 },
}));
