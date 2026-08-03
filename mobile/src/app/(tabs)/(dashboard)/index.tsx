import { ContentUnavailableView, Host } from '@expo/ui/swift-ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  useAccounts,
  useAnnualGoal,
  useDaily,
  useEquityCurve,
  useSummary,
  useTrades,
} from '@/api/hooks';
import { BreakdownCard } from '@/components/breakdown-card';
import { DashboardCard } from '@/components/dashboard-card';
import { EquityCard } from '@/components/equity-card';
import { GoalCard } from '@/components/goal-card';
import { InsightsCard } from '@/components/insights-card';
import { MiniCalendarCard } from '@/components/mini-calendar-card';
import { PerformanceCard } from '@/components/performance-card';
import { Skeleton } from '@/components/skeleton';
import { TradeRow } from '@/components/trade-row';
import { t } from '@lingui/core/macro';
import { useSelectedAccountId } from '@/lib/account-store';
import { useGlobalFilters } from '@/lib/filters';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency } from '@/lib/prefs';

/** Recent trades shown on the overview — the full log lives on the Trades tab. */
const RECENT_LIMIT = 5;

export default function DashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme } = useUnistyles();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`;
  const yearStart = `${year}-01-01T00:00:00Z`;

  const filters = useGlobalFilters();
  const summary = useSummary(filters);
  const equity = useEquityCurve(filters);
  const trades = useTrades(filters);
  const accounts = useAccounts();
  const daily = useDaily({ ...filters, from: monthStart });
  const goal = useAnnualGoal(year);
  const ytd = useSummary({ ...filters, from: yearStart });

  const selectedAccountId = useSelectedAccountId();
  const baseCurrency = accountBaseCurrency(accounts.data, selectedAccountId);
  const fx = useMoneyFx(baseCurrency);
  const currency = fx.currency;
  const fxRate = fx.rate ?? 1;
  const refreshing = summary.isRefetching || trades.isRefetching || equity.isRefetching;
  const refreshAll = () => void queryClient.invalidateQueries();

  if (summary.isLoading) {
    // Card-shaped skeletons standing in for the performance, equity, and
    // breakdown blocks.
    return (
      <ScrollView
        style={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <Skeleton style={styles.skeletonCardTall} />
        <Skeleton style={styles.skeletonCard} />
        <Skeleton style={styles.skeletonCard} />
      </ScrollView>
    );
  }

  if (summary.error) {
    return (
      <View style={styles.centered}>
        <Text selectable style={styles.error}>
          {summary.error.message}
        </Text>
      </View>
    );
  }

  // The query is disabled once sign-out clears the session; the tabs gate
  // redirects, but this render can still land first with no data.
  if (!summary.data) return null;

  const tradeList = trades.data ?? [];
  const noData = summary.data.total_trades === 0 && tradeList.length === 0 && !trades.isLoading;

  if (noData) {
    return (
      <Host style={styles.centered}>
        <ContentUnavailableView
          title={t`No trades yet`}
          systemImage="chart.line.uptrend.xyaxis"
          description={t`Import broker history or log a trade on the web app to see performance here.`}
        />
      </Host>
    );
  }

  const recentTrades = tradeList.slice(0, RECENT_LIMIT);

  return (
    <ScrollView
      style={styles.page}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
    >
      <PerformanceCard
        summary={summary.data}
        trades={tradeList}
        currency={currency}
        fxRate={fxRate}
      />

      {equity.isLoading ? (
        <Skeleton style={styles.skeletonCard} />
      ) : equity.error ? (
        <DashboardCard title={t`Equity curve`}>
          <Text style={styles.cardError}>{t`Failed to load equity curve.`}</Text>
        </DashboardCard>
      ) : equity.data ? (
        <EquityCard curve={equity.data} currency={currency} fxRate={fxRate} />
      ) : null}

      {goal.data?.amount != null && ytd.data ? (
        <GoalCard
          year={year}
          goalAmount={goal.data.amount}
          ytdNetPnl={ytd.data.net_pnl}
          currency={currency}
          fxRate={fxRate}
        />
      ) : null}

      <InsightsCard
        summary={summary.data}
        trades={tradeList}
        currency={currency}
        maxDrawdown={equity.data?.max_drawdown}
        fxRate={fxRate}
      />

      <MiniCalendarCard
        year={year}
        month={month}
        dailyPnl={daily.data ?? {}}
        currency={currency}
        fxRate={fxRate}
        onOpenCalendar={() => router.navigate('/(tabs)/(calendar)')}
      />

      <BreakdownCard />

      {/* Journal quick links — Notes and Playbook live behind Home, not a tab. */}
      <View style={styles.quickLinks}>
        <Pressable
          onPress={() => router.push('/(tabs)/(dashboard)/notes')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.quickLink, pressed && styles.quickLinkPressed]}
        >
          <SymbolView name="note.text" size={20} tintColor={theme.colors.accent} />
          <Text style={styles.quickLinkLabel}>{t`Notes`}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/(dashboard)/playbook')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.quickLink, pressed && styles.quickLinkPressed]}
        >
          <SymbolView name="book" size={20} tintColor={theme.colors.accent} />
          <Text style={styles.quickLinkLabel}>{t`Playbook`}</Text>
        </Pressable>
      </View>

      <View style={styles.recent}>
        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>{t`Recent trades`}</Text>
          <Text style={styles.recentAction} onPress={() => router.navigate('/(tabs)/(trades)')}>
            {t`View all`} ›
          </Text>
        </View>
        {recentTrades.length === 0 ? (
          <Text style={styles.cardError}>{t`No trades in this range.`}</Text>
        ) : (
          recentTrades.map((trade) => <TradeRow key={trade.id} trade={trade} />)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  error: { color: theme.colors.mutedForeground, textAlign: 'center' },
  skeletonCardTall: { height: 240, borderRadius: theme.radius.lg + 4 },
  skeletonCard: { height: 180, borderRadius: theme.radius.lg + 4 },
  cardError: { fontSize: 13, color: theme.colors.mutedForeground },
  quickLinks: { flexDirection: 'row', gap: theme.spacing.sm },
  quickLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    paddingVertical: theme.spacing.lg,
  },
  quickLinkPressed: { opacity: 0.7 },
  quickLinkLabel: { fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  recent: { gap: theme.spacing.sm },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
  },
  recentTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  recentAction: { fontSize: 13, fontWeight: '500', color: theme.colors.foreground },
}));
