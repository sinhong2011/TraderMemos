import { ContentUnavailableView } from '@expo/ui/swift-ui';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';
import { useAccounts, useBreakdown, useSetups } from '@/api/hooks';
import type { BreakGroup, Setup } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { ErrorState } from '@/components/error-state';
import { Pill } from '@/components/pill';
import { Skeleton } from '@/components/skeleton';
import { StatBar } from '@/components/stat-bar';
import { TradeFilterMenu } from '@/components/trade-filter-menu';
import { t } from '@lingui/core/macro';
import { useSelectedAccountId } from '@/lib/account-store';
import { useGlobalFilters } from '@/lib/filters';
import { formatPercent, formatRatio, useFormatters } from '@/lib/format';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency } from '@/lib/prefs';
import { pnlColor } from '@/styles/unistyles';
import { AppHost } from '@/components/app-host';

type SortKey = 'name' | 'trades' | 'winRate' | 'pf' | 'exp' | 'pnl';

type SetupRow = {
  setup: Setup;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  pf: number;
  exp: number;
  hasData: boolean;
};

/** Join setups with the by-setup breakdown on name (web buildRows). */
function buildRows(setups: Setup[], breakdown: BreakGroup[]): SetupRow[] {
  return setups.map((setup) => {
    const sum = breakdown.find((group) => group.key === setup.name)?.summary;
    const trades = sum?.total_trades ?? 0;
    return {
      setup,
      trades,
      wins: sum?.wins ?? 0,
      losses: sum?.losses ?? 0,
      winRate: sum?.win_rate ?? 0,
      netPnl: sum?.net_pnl ?? 0,
      pf: sum?.profit_factor ?? 0,
      exp: sum?.expectancy ?? 0,
      hasData: trades > 0,
    };
  });
}

const SORT_VALUE: Record<SortKey, (row: SetupRow) => number | string> = {
  name: (r) => r.setup.name.toLowerCase(),
  trades: (r) => r.trades,
  winRate: (r) => r.winRate,
  pf: (r) => r.pf,
  exp: (r) => r.exp,
  pnl: (r) => r.netPnl,
};

function sortRows(rows: SetupRow[], key: SortKey): SetupRow[] {
  const read = SORT_VALUE[key];
  // Name ascends; every metric descends (best first).
  const dir = key === 'name' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = read(a);
    const bv = read(b);
    const primary = typeof av === 'string' ? av.localeCompare(bv as string) : av - (bv as number);
    if (primary !== 0) return dir * primary;
    return a.setup.name.localeCompare(b.setup.name);
  });
}

/** Levels + checklist size — the plan detail worth a meta line (web planBits). */
function planBits(setup: Setup): string[] {
  const checks = setup.checklist ?? [];
  return [
    setup.symbol ? setup.symbol : null,
    setup.target_price != null ? `T ${setup.target_price}` : null,
    setup.stop_price != null ? `S ${setup.stop_price}` : null,
    checks.length > 0 ? t`${checks.length} checks` : null,
  ].filter((bit): bit is string => bit != null);
}

/** Playbook — every setup scored by its traded results in the current scope. */
export default function PlaybookScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const filters = useGlobalFilters();
  const setups = useSetups();
  const breakdown = useBreakdown('setup', filters);
  const accounts = useAccounts();
  const selectedAccountId = useSelectedAccountId();
  const fx = useMoneyFx(accountBaseCurrency(accounts.data, selectedAccountId));
  const currency = fx.currency;
  const fxRate = fx.rate ?? 1;
  const { formatPnlCompact } = useFormatters();

  const [sortKey, setSortKey] = useState<SortKey>('pnl');

  const rows = useMemo(
    () => sortRows(buildRows(setups.data ?? [], breakdown.data ?? []), sortKey),
    [setups.data, breakdown.data, sortKey],
  );
  const traded = rows.filter((row) => row.hasData);
  const untraded = rows.filter((row) => !row.hasData);
  const totals = traded.reduce(
    (acc, row) => ({
      trades: acc.trades + row.trades,
      wins: acc.wins + row.wins,
      losses: acc.losses + row.losses,
      pnl: acc.pnl + row.netPnl,
    }),
    { trades: 0, wins: 0, losses: 0, pnl: 0 },
  );
  const top = traded.length > 0 ? [...traded].sort((a, b) => b.netPnl - a.netPnl)[0] : null;

  const sortOptions = [
    { value: 'pnl', label: t`Net P&L` },
    { value: 'trades', label: t`Trades` },
    { value: 'winRate', label: t`Win rate` },
    { value: 'pf', label: t`Profit factor` },
    { value: 'exp', label: t`Expectancy` },
    { value: 'name', label: t`Name` },
  ];

  const loading = setups.isLoading || breakdown.isLoading;

  /*
    Creating a play belongs on the screen that holds them, not only in the
    global + on Trades: this is where you come to work on the playbook, and the
    empty state was sending people to another tab to fill it. The editor itself
    stays its own screen (new-setup.tsx) — a name, a thesis, levels and a
    checklist is a page, not something to inline under the stats.
  */
  const headerActions = (
    <View style={styles.headerActions}>
      <TradeFilterMenu
        active={false}
        label={t`Sort`}
        systemImage="arrow.up.arrow.down"
        groups={[
          {
            key: 'sort',
            options: sortOptions,
            value: sortKey,
            onChange: (value) => setSortKey(value as SortKey),
          },
        ]}
      />
      <Pressable
        onPress={() => router.push('/new-setup')}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t`New setup`}
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
      >
        <Icon name="plus" size={18} tintColor={theme.colors.foreground} weight="semibold" />
      </Pressable>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: t`Playbook`, headerRight: () => headerActions }} />
      <ScrollView
        style={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        // Inline title, not large — see the note in (settings)/funding.tsx. A
        // native RefreshControl on a pushed `headerLargeTitle` screen leaks its
        // 60pt height into the stack's top inset on every push, so the content
        // starts lower each time the screen is entered.
        refreshControl={
          <RefreshControl
            refreshing={setups.isRefetching || breakdown.isRefetching}
            onRefresh={() => {
              void setups.refetch();
              void breakdown.refetch();
            }}
          />
        }
      >
        {loading ? (
          <>
            <Skeleton style={styles.skeletonCard} />
            <Skeleton style={styles.skeletonCard} />
          </>
        ) : (setups.error || breakdown.error) && setups.data == null ? (
          // Ahead of the empty state on purpose: that one tells you to write
          // your first play, which is the wrong thing to hear when the plays
          // are on a server this phone can't reach. The setups are what the
          // screen lists, so cached ones still render — scored by whatever
          // breakdown the cache holds.
          <View style={styles.emptyHost}>
            <ErrorState
              error={setups.error ?? breakdown.error}
              onRetry={() => {
                void setups.refetch();
                void breakdown.refetch();
              }}
              retrying={setups.isRefetching || breakdown.isRefetching}
            />
          </View>
        ) : (setups.data ?? []).length === 0 ? (
          <AppHost style={styles.emptyHost}>
            <ContentUnavailableView
              title={t`No setups yet`}
              systemImage="book"
              description={t`Tap + to write the first play you trade — trades link to it from the trade form.`}
            />
          </AppHost>
        ) : (
          <>
            <DashboardCard title={t`Playbook`} flush>
              <View style={styles.grid}>
                <StatBar
                  label={t`Plays traded`}
                  value={`${traded.length}/${rows.length}`}
                  tone="accent"
                />
                <StatBar label={t`Trades`} value={String(totals.trades)} />
                <StatBar
                  label={t`Win rate`}
                  value={formatPercent(totals.trades > 0 ? totals.wins / totals.trades : 0, 0)}
                  tone={totals.wins >= totals.losses ? 'pos' : 'neg'}
                />
                <StatBar
                  label={t`Net P&L`}
                  value={formatPnlCompact(totals.pnl * fxRate, currency)}
                  tone={totals.pnl >= 0 ? 'pos' : 'neg'}
                />
                {top ? (
                  <StatBar
                    label={t`Top play`}
                    value={top.setup.name}
                    sub={formatPnlCompact(top.netPnl * fxRate, currency)}
                    tone="pos"
                  />
                ) : null}
              </View>
            </DashboardCard>

            <DashboardCard title={t`Traded in this range`}>
              {traded.length === 0 ? (
                <Text style={styles.empty}>{t`No setups traded in this range.`}</Text>
              ) : (
                <View style={styles.rows}>
                  {traded.map((row) => (
                    <Pressable
                      key={row.setup.id}
                      onPress={() =>
                        router.push({ pathname: '/new-setup', params: { id: row.setup.id } })
                      }
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                      <View style={styles.rowHead}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {row.setup.name}
                        </Text>
                        <Text
                          style={[styles.rowPnl, { color: pnlColor(theme.colors, row.netPnl) }]}
                        >
                          {formatPnlCompact(row.netPnl * fxRate, currency)}
                        </Text>
                      </View>
                      <Text style={styles.rowMeta}>
                        {t`${row.trades} trades`} · {formatPercent(row.winRate, 0)} · PF{' '}
                        {formatRatio(row.pf)} · {t`exp`}{' '}
                        {formatPnlCompact(row.exp * fxRate, currency)}
                      </Text>
                      {planBits(row.setup).length > 0 ? (
                        <Text style={styles.rowPlan} numberOfLines={1}>
                          {planBits(row.setup).join(' · ')}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              )}
            </DashboardCard>

            {untraded.length > 0 ? (
              <DashboardCard title={t`Not traded in this range`}>
                <View style={styles.chipWrap}>
                  {untraded.map((row) => (
                    <Pressable
                      key={row.setup.id}
                      onPress={() =>
                        router.push({ pathname: '/new-setup', params: { id: row.setup.id } })
                      }
                      accessibilityRole="button"
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <Pill tone="muted">{row.setup.name}</Pill>
                    </Pressable>
                  ))}
                </View>
              </DashboardCard>
            ) : null}
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  addButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  rows: { gap: theme.spacing.md },
  row: { gap: 2 },
  pressed: { opacity: 0.6 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rowName: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  rowPnl: { fontSize: 15, fontWeight: '600', ...theme.numeric },
  rowMeta: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  rowPlan: { fontSize: 12, color: theme.colors.mutedForeground },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  empty: { fontSize: 13, color: theme.colors.mutedForeground, paddingVertical: theme.spacing.sm },
  emptyHost: { minHeight: 320 },
  skeletonCard: { height: 200, borderRadius: theme.radius.lg + 4 },
}));
