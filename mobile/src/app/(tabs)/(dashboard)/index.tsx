import { ContentUnavailableView, Host } from '@expo/ui/swift-ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

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
import { TradeRow } from '@/components/trade-row';
import { t } from '@lingui/core/macro';

/** Recent trades shown on the overview — the full log lives on the Trades tab. */
const RECENT_LIMIT = 5;

export default function DashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`;
  const yearStart = `${year}-01-01T00:00:00Z`;

  const summary = useSummary();
  const equity = useEquityCurve();
  const trades = useTrades();
  const accounts = useAccounts();
  const daily = useDaily({ from: monthStart });
  const goal = useAnnualGoal(year);
  const ytd = useSummary({ from: yearStart });

  const currency = accounts.data?.[0]?.base_currency ?? 'USD';
  const refreshing = summary.isRefetching || trades.isRefetching || equity.isRefetching;
  const refreshAll = () => void queryClient.invalidateQueries();

  if (summary.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
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
      <PerformanceCard summary={summary.data} trades={tradeList} currency={currency} />

      {equity.isLoading ? null : equity.error ? (
        <DashboardCard title={t`Equity curve`}>
          <Text style={styles.cardError}>{t`Failed to load equity curve.`}</Text>
        </DashboardCard>
      ) : equity.data ? (
        <EquityCard curve={equity.data} currency={currency} />
      ) : null}

      {goal.data?.amount != null && ytd.data ? (
        <GoalCard
          year={year}
          goalAmount={goal.data.amount}
          ytdNetPnl={ytd.data.net_pnl}
          currency={currency}
        />
      ) : null}

      <InsightsCard
        summary={summary.data}
        trades={tradeList}
        currency={currency}
        maxDrawdown={equity.data?.max_drawdown}
      />

      <MiniCalendarCard year={year} month={month} dailyPnl={daily.data ?? {}} currency={currency} />

      <BreakdownCard />

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
  cardError: { fontSize: 13, color: theme.colors.mutedForeground },
  recent: { gap: theme.spacing.sm },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
  },
  recentTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  recentAction: { fontSize: 13, fontWeight: '500', color: theme.colors.primary },
}));
