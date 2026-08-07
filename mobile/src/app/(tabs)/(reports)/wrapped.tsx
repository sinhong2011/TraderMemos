import { ContentUnavailableView } from '@expo/ui/swift-ui';
import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router/stack';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useAccounts, useTrades } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
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
import { AppHost } from '@/components/app-host';

const MIN_YEAR = 2000;

function monthShort(month: number): string {
  return new Date(Date.UTC(2024, month, 1)).toLocaleDateString(locale, {
    month: 'short',
    timeZone: 'UTC',
  });
}

/** Annual recap — the web Year Wrapped, as a card stack with a year stepper. */
export default function WrappedScreen() {
  const { theme } = useUnistyles();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const selectedAccountId = useSelectedAccountId();
  const trades = useTrades({
    ...(selectedAccountId ? { account_id: selectedAccountId } : {}),
    from: `${year}-01-01T00:00:00Z`,
    to: `${year + 1}-01-01T00:00:00Z`,
  });
  const accounts = useAccounts();
  const fx = useMoneyFx(accountBaseCurrency(accounts.data, selectedAccountId));
  const currency = fx.currency;
  const rate = fx.rate ?? 1;
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatPnl, formatPnlCompact } = useFormatters();

  const wrapped = useMemo(() => computeYearWrapped(trades.data ?? [], year), [trades.data, year]);
  const money = (v: number) => formatPnl(v * rate, currency);
  const moneyCompact = (v: number) => formatPnlCompact(v * rate, currency);
  const maxMonthTrades = Math.max(...wrapped.months.map((m) => m.trades), 1);
  const inProgress = year === currentYear;

  return (
    <>
      <Stack.Screen options={{ title: t`Year Wrapped`, headerLargeTitle: false }} />
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
        {/* Year stepper */}
        <View style={styles.stepper}>
          <Pressable
            onPress={() => setYear((y) => Math.max(MIN_YEAR, y - 1))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t`Previous year`}
            style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
          >
            <SymbolView name="chevron.left" size={15} tintColor={theme.colors.foreground} />
          </Pressable>
          <Text style={styles.yearLabel}>
            {year}
            {inProgress ? <Text style={styles.inProgress}> · {t`in progress`}</Text> : null}
          </Text>
          <Pressable
            onPress={() => setYear((y) => Math.min(currentYear, y + 1))}
            disabled={year >= currentYear}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t`Next year`}
            style={({ pressed }) => [
              styles.stepButton,
              year >= currentYear && styles.stepDisabled,
              pressed && styles.pressed,
            ]}
          >
            <SymbolView name="chevron.right" size={15} tintColor={theme.colors.foreground} />
          </Pressable>
        </View>

        {trades.isLoading ? (
          <>
            <Skeleton style={styles.skeletonTall} />
            <Skeleton style={styles.skeletonCard} />
          </>
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.muted,
  },
  stepDisabled: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
  yearLabel: { fontSize: 18, fontWeight: '600', color: theme.colors.foreground, ...theme.numeric },
  inProgress: { fontSize: 13, fontWeight: '400', color: theme.colors.mutedForeground },
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
