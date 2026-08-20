
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Card, Skeleton } from 'panelui-native';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import {
  useAccounts,
  useAnnualGoal,
  useDaily,
  useEquityCurve,
  useSummary,
  useTrades,
} from '@/api/hooks';
import { EmptyState } from '@/components/empty-state';
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
import { TradeRow } from '@/components/trade-row';
import { t } from '@lingui/core/macro';
import { useSelectedAccountId } from '@/lib/account-store';
import { dayKeyInTz } from '@/lib/events';
import { useGlobalFilters } from '@/lib/filters';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency, resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';

/** Recent trades shown on the overview — the full log lives on the Trades tab. */
const RECENT_LIMIT = 5;

/** The page inset every card block sits in. */
const CONTENT = 'gap-4 p-4 pb-12';

/** Card-shaped stand-in while a block's query is still out. */
const SKELETON_CARD = 'h-[180px] rounded-[18px]';

/** Journal quick link — a card the whole tile presses. */
const QUICK_LINK = 'flex-row items-center justify-center gap-2 rounded-lg border-0 py-4';

export default function DashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // The quick-link glyphs are tinted with a JS value, not a class.
  const [heading, mutedForeground] = useCSSVariable(['--color-heading', '--color-muted-foreground']) as [string, string];

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
        className="bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName={CONTENT}
      >
        <Skeleton className="h-[240px] rounded-[18px]" label={t`Loading your dashboard`} />
        <Skeleton className={SKELETON_CARD} />
        <Skeleton className={SKELETON_CARD} />
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
      <View className="flex-1 items-center justify-center p-6">
        <EmptyState
          title={t`No trades yet`}
          systemImage="chart.line.uptrend.xyaxis"
          description={t`Log a trade from the Trades tab, or import from Settings → Import trades.`}
        />
      </View>
    );
  }

  const recentTrades = tradeList.slice(0, RECENT_LIMIT);

  return (
    <ScrollView
      className="bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName={CONTENT}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
    >
      {/* The curve leads: the shape of the account answers "how am I doing"
          faster than the aggregates below it, which read as its detail. */}
      {equity.isLoading ? (
        <Skeleton className={SKELETON_CARD} />
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
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => router.push('/(tabs)/(dashboard)/notes')}
          accessibilityRole="button"
          className="flex-1 active:opacity-70"
        >
          <Card className={QUICK_LINK}>
            <Icon name="note.text" size={20} tintColor={heading} />
            <Text className="text-[15px] font-semibold text-foreground">{t`Notes`}</Text>
          </Card>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/(dashboard)/playbook')}
          accessibilityRole="button"
          className="flex-1 active:opacity-70"
        >
          <Card className={QUICK_LINK}>
            <Icon name="book" size={20} tintColor={heading} />
            <Text className="text-[15px] font-semibold text-foreground">{t`Playbook`}</Text>
          </Card>
        </Pressable>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center justify-between px-1 pt-2">
          {/* Matches DashboardCard's section header — this is the one heading on
              Home that isn't drawn by that component, and it read as a
              different rank. */}
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t`Recent trades`}
          </Text>
          <Text
            className="text-[13px] font-medium text-foreground"
            onPress={() => router.navigate('/(tabs)/(trades)')}
          >
            {t`View all`} ›
          </Text>
        </View>
        {/* An outage must not read as a clean slate: "No trades in this range"
            is a claim about the data, and we only get to make it once the
            request actually came back. */}
        {trades.error && trades.data == null ? (
          <InlineError error={trades.error} onRetry={() => void trades.refetch()} />
        ) : recentTrades.length === 0 ? (
          <Text className="text-[13px] text-muted-foreground">{t`No trades in this range.`}</Text>
        ) : (
          recentTrades.map((trade) => <TradeRow key={trade.id} trade={trade} />)
        )}
      </View>

      {/* The dashboard is the appetiser — the full analysis lives one tap away. */}
      <Pressable
        onPress={() => router.navigate('/(tabs)/(dashboard)/reports')}
        accessibilityRole="button"
        className="flex-row items-center gap-3 rounded-2xl bg-card px-4 py-3.5 active:opacity-70"
      >
        <Icon name="chart.pie" size={18} tintColor={heading} />
        <Text className="flex-1 text-[15px] font-medium text-foreground">{t`Full reports`}</Text>
        <Icon name="chevron.right" size={12} tintColor={mutedForeground} />
      </Pressable>
    </ScrollView>
  );
}
