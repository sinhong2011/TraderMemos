import { ContentUnavailableView } from '@expo/ui/swift-ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
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
import { Icon } from '@/components/icon';
import { BreakdownCard } from '@/components/breakdown-card';
import { ChecklistCard } from '@/components/checklist-card';
import { DailyLossCard } from '@/components/daily-loss-card';
import { DashboardCard } from '@/components/dashboard-card';
import { EquityCard } from '@/components/equity-card';
import { ErrorState, InlineError } from '@/components/error-state';
import { GoalCard } from '@/components/goal-card';
import { InsightsCard } from '@/components/insights-card';
import { MiniCalendarCard } from '@/components/mini-calendar-card';
import { PerformanceCard } from '@/components/performance-card';
import { PropStatusCard } from '@/components/prop-status-card';
import { Skeleton } from '@/components/skeleton';
import { TradeRow } from '@/components/trade-row';
import { t } from '@lingui/core/macro';
import { useSelectedAccountId } from '@/lib/account-store';
import { dayKeyInTz } from '@/lib/events';
import { useGlobalFilters } from '@/lib/filters';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency, resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';
import { AppHost } from '@/components/app-host';

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

  // Today on the market clock — the same day key /analytics/daily buckets by.
  const { marketTimezone } = useDisplayPrefs();
  const todayKey = dayKeyInTz(new Date().toISOString(), resolveMarketTimezone(marketTimezone));
  const todayNetPnl = daily.data?.[todayKey] ?? 0;
  const selectedAccount = selectedAccountId
    ? accounts.data?.find((account) => account.id === selectedAccountId)
    : undefined;
  const propAccountId = selectedAccount?.account_type === 'prop' ? selectedAccount.id : null;
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

  // Summary is the screen: every card below either renders it or hangs off it,
  // so its failure is the whole tab's failure. The per-card errors further down
  // stay inline — one dead widget shouldn't cost the user the other nine.
  //
  // Only when there is nothing cached to fall back on, though. The MMKV
  // persister exists precisely so a trader on a plane still sees last night's
  // numbers; throwing them away for an error screen would defeat it. The
  // offline banner is what admits the figures are stale.
  if (summary.error && summary.data == null) {
    return (
      <ErrorState
        error={summary.error}
        onRetry={() => void queryClient.refetchQueries({ type: 'active' })}
        retrying={summary.isRefetching}
      />
    );
  }

  // The query is disabled once sign-out clears the session; the tabs gate
  // redirects, but this render can still land first with no data.
  if (!summary.data) return null;

  const tradeList = trades.data ?? [];
  const noData = summary.data.total_trades === 0 && tradeList.length === 0 && !trades.isLoading;

  if (noData) {
    return (
      <AppHost style={styles.centered}>
        <ContentUnavailableView
          title={t`No trades yet`}
          systemImage="chart.line.uptrend.xyaxis"
          description={t`Import broker history or log a trade on the web app to see performance here.`}
        />
      </AppHost>
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
      {/* The curve leads: the shape of the account answers "how am I doing"
          faster than the aggregates below it, which read as its detail. */}
      {equity.isLoading ? (
        <Skeleton style={styles.skeletonCard} />
      ) : equity.error && equity.data == null ? (
        <DashboardCard title={t`Equity curve`}>
          <InlineError error={equity.error} onRetry={() => void equity.refetch()} />
        </DashboardCard>
      ) : equity.data ? (
        <EquityCard curve={equity.data} currency={currency} fxRate={fxRate} />
      ) : null}

      {/* Today's discipline sits right under the curve: the checklist is the
          first thing to clear, before any of the aggregates below. */}
      <ChecklistCard />

      <PerformanceCard
        summary={summary.data}
        trades={tradeList}
        currency={currency}
        fxRate={fxRate}
      />

      {/* The loss limit is the line not to cross. */}
      <DailyLossCard todayNetPnl={todayNetPnl} currency={currency} fxRate={fxRate} />

      {propAccountId ? (
        <PropStatusCard accountId={propAccountId} currency={currency} fxRate={fxRate} />
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
          <Icon name="note.text" size={20} tintColor={theme.colors.accent} />
          <Text style={styles.quickLinkLabel}>{t`Notes`}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/(dashboard)/playbook')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.quickLink, pressed && styles.quickLinkPressed]}
        >
          <Icon name="book" size={20} tintColor={theme.colors.accent} />
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
        {/* An outage must not read as a clean slate: "No trades in this range"
            is a claim about the data, and we only get to make it once the
            request actually came back. */}
        {trades.error && trades.data == null ? (
          <InlineError error={trades.error} onRetry={() => void trades.refetch()} />
        ) : recentTrades.length === 0 ? (
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
    boxShadow: theme.shadows.card,
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
  // Matches DashboardCard's section header — this is the one heading on Home
  // that isn't drawn by that component, and it read as a different rank.
  recentTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: theme.colors.mutedForeground,
  },
  recentAction: { fontSize: 13, fontWeight: '500', color: theme.colors.foreground },
}));
