import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useTags, useTrades } from '@/api/hooks';
import type { Trade } from '@/api/types';
import { AccountMenu } from '@/components/account-menu';
import { FloatingSearchBar, SearchToggle } from '@/components/search-bar';
import { Skeleton } from '@/components/skeleton';
import { SwipeableTradeRow } from '@/components/swipeable-trade-row';
import { TradeFilterMenu } from '@/components/trade-filter-menu';
import { t } from '@lingui/core/macro';
import { useGlobalFilters } from '@/lib/filters';
import { formatPnl } from '@/lib/format';
import { parseEmotionalStates } from '@/lib/journal';
import { useDisplayPrefs } from '@/lib/prefs';
import { useTagBarState } from '@/lib/tag-bar';
import { pnlColor } from '@/styles/unistyles';

type StatusFilter = 'all' | 'win' | 'loss' | 'open';
type DateFilter = 'all' | 'today' | 'week' | 'month' | '30d' | 'year';
type MarketFilter = 'all' | 'stock' | 'option' | 'crypto' | 'future' | 'forex';
type SortOrder = 'newest' | 'oldest' | 'pnl-desc' | 'pnl-asc' | 'symbol';

/** One quick-filter chip: key encodes the dimension (see lib/tag-bar.ts). */
type ChipDef = { key: string; label: string; neg: boolean };

function matchesChip(key: string, trade: Trade): boolean {
  if (key === 'all') return true;
  const sep = key.indexOf(':');
  const kind = key.slice(0, sep);
  const value = key.slice(sep + 1);
  switch (kind) {
    case 'tag':
      return trade.tags.some((tag) => tag.id === value);
    case 'setup':
      return trade.setup_id === value;
    case 'emotion':
      return parseEmotionalStates(trade.emotional_state).includes(value);
    case 'sgrade':
      return trade.confidence === Number(value);
    case 'egrade':
      return trade.trade_quality === Number(value);
    default:
      return true;
  }
}

function compareTrades(
  order: SortOrder,
  a: { opened_at: string; net_pnl: number | null; symbol: string },
  b: { opened_at: string; net_pnl: number | null; symbol: string },
): number {
  switch (order) {
    case 'newest':
      return b.opened_at.localeCompare(a.opened_at);
    case 'oldest':
      return a.opened_at.localeCompare(b.opened_at);
    case 'pnl-desc':
      return (b.net_pnl ?? Number.NEGATIVE_INFINITY) - (a.net_pnl ?? Number.NEGATIVE_INFINITY);
    case 'pnl-asc':
      return (a.net_pnl ?? Number.POSITIVE_INFINITY) - (b.net_pnl ?? Number.POSITIVE_INFINITY);
    case 'symbol':
      return a.symbol.localeCompare(b.symbol) || b.opened_at.localeCompare(a.opened_at);
  }
}

/** Local-midnight-anchored range start for the server-side `from` filter. */
function rangeStart(filter: DateFilter, nowMs: number): string | undefined {
  if (filter === 'all') return undefined;
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  switch (filter) {
    case 'today':
      break;
    case 'week':
      d.setDate(d.getDate() - d.getDay());
      break;
    case 'month':
      d.setDate(1);
      break;
    case '30d':
      d.setDate(d.getDate() - 30);
      break;
    case 'year':
      d.setMonth(0, 1);
      break;
  }
  return d.toISOString();
}

function matchesStatus(filter: StatusFilter, trade: { status: string; net_pnl: number | null }) {
  switch (filter) {
    case 'all':
      return true;
    case 'open':
      return trade.status === 'open';
    case 'win':
      return trade.status !== 'open' && (trade.net_pnl ?? 0) > 0;
    case 'loss':
      return trade.status !== 'open' && (trade.net_pnl ?? 0) < 0;
  }
}

function RowGap() {
  return <View style={styles.rowGap} />;
}

/**
 * Horizontal quick-filter chips under the search bar (iOS 26 bordered
 * capsules), each showing its trade count, with a fixed trailing button that
 * opens the manage-tags sheet.
 */
function TagBar({
  chips,
  counts,
  total,
  selected,
  onSelect,
  onManage,
}: {
  chips: ChipDef[];
  counts: Map<string, number>;
  total: number;
  selected: string;
  onSelect: (key: string) => void;
  onManage: () => void;
}) {
  const { theme } = useUnistyles();
  const sorted = [...chips].sort((a, b) => (counts.get(b.key) ?? 0) - (counts.get(a.key) ?? 0));

  const chip = (key: string, label: string, count: number, neg: boolean) => {
    const active = selected === key;
    const color = neg ? theme.colors.loss : theme.colors.primary;
    return (
      <Pressable
        key={key}
        onPress={() => onSelect(key)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={({ pressed }) => [
          styles.tagChip,
          // Active state is background-only — border and text stay put.
          active && { backgroundColor: `${color}26` },
          pressed && styles.swipePressed,
        ]}
      >
        <Text style={styles.tagChipLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.tagChipCount} numberOfLines={1}>
          {count}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.tagBarRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tagBar}
        style={styles.tagBarScroll}
      >
        {chip('all', t`All`, total, false)}
        {sorted.map((def) => chip(def.key, def.label, counts.get(def.key) ?? 0, def.neg))}
      </ScrollView>
      <Pressable
        onPress={onManage}
        accessibilityRole="button"
        accessibilityLabel={t`Manage tags`}
        style={({ pressed }) => [styles.tagManage, pressed && styles.swipePressed]}
      >
        <SymbolView
          name="slider.horizontal.3"
          size={13}
          tintColor={theme.colors.mutedForeground}
        />
      </Pressable>
    </View>
  );
}

export default function TradesScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [market, setMarket] = useState<MarketFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [tagFilter, setTagFilter] = useState('all');
  // Captured once per mount so the query key doesn't churn between renders.
  const [nowMs] = useState(() => Date.now());
  const from = rangeStart(dateFilter, nowMs);
  const globalFilters = useGlobalFilters();
  const { data, isLoading, error, refetch, isRefetching } = useTrades({
    ...globalFilters,
    ...(from ? { from } : {}),
  });
  // Re-render when privacy mode flips — the net summary formats money.
  useDisplayPrefs();
  const { data: tags } = useTags();
  const { hiddenTagIds, extras } = useTagBarState();

  const chipDefs = useMemo<ChipDef[]>(
    () => [
      ...(tags ?? [])
        .filter((tag) => !hiddenTagIds.includes(tag.id))
        .map((tag) => ({ key: `tag:${tag.id}`, label: tag.name, neg: tag.kind === 'mistake' })),
      ...extras.map((extra) => ({ key: extra.key, label: extra.label, neg: false })),
    ],
    [tags, hiddenTagIds, extras],
  );
  // A chip removed in the picker can't stay the active filter.
  const activeChip =
    tagFilter !== 'all' && !chipDefs.some((def) => def.key === tagFilter) ? 'all' : tagFilter;

  const chipCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const def of chipDefs) counts.set(def.key, 0);
    for (const trade of data ?? []) {
      for (const def of chipDefs) {
        if (matchesChip(def.key, trade)) counts.set(def.key, (counts.get(def.key) ?? 0) + 1);
      }
    }
    return counts;
  }, [data, chipDefs]);

  const trades = useMemo(() => {
    const rows = (data ?? []).filter(
      (trade) =>
        matchesStatus(status, trade) &&
        (market === 'all' || trade.instrument_type === market) &&
        matchesChip(activeChip, trade),
    );
    const term = search.trim().toUpperCase();
    const matched = term
      ? rows.filter(
          (trade) =>
            trade.symbol.toUpperCase().includes(term) ||
            trade.tags.some((tag) => tag.name.toUpperCase().includes(term)),
        )
      : rows;
    return [...matched].sort((a, b) => compareTrades(sortOrder, a, b));
  }, [data, search, status, market, sortOrder, activeChip]);

  const netTotal = useMemo(
    () => trades.reduce((sum, trade) => sum + (trade.net_pnl ?? 0), 0),
    [trades],
  );

  const filters = [
    { value: 'all' as const, label: t`All` },
    { value: 'win' as const, label: t`Wins` },
    { value: 'loss' as const, label: t`Losses` },
    { value: 'open' as const, label: t`Open` },
  ];
  const dateFilters = [
    { value: 'all' as const, label: t`All time` },
    { value: 'today' as const, label: t`Today` },
    { value: 'week' as const, label: t`This week` },
    { value: 'month' as const, label: t`This month` },
    { value: '30d' as const, label: t`Last 30 days` },
    { value: 'year' as const, label: t`This year` },
  ];
  const markets = [
    { value: 'all' as const, label: t`All markets` },
    { value: 'stock' as const, label: t`Stock` },
    { value: 'option' as const, label: t`Option` },
    { value: 'crypto' as const, label: t`Crypto` },
    { value: 'future' as const, label: t`Futures` },
    { value: 'forex' as const, label: t`Forex` },
  ];
  const sortOrders = [
    { value: 'newest' as const, label: t`Newest first` },
    { value: 'oldest' as const, label: t`Oldest first` },
    { value: 'pnl-desc' as const, label: t`Highest P&L` },
    { value: 'pnl-asc' as const, label: t`Lowest P&L` },
    { value: 'symbol' as const, label: t`Symbol A–Z` },
  ];
  const filtersActive = status !== 'all' || dateFilter !== 'all' || market !== 'all';

  if (isLoading) {
    // Row-shaped skeletons standing in for the trade list.
    return (
      <View style={[styles.page, styles.content, styles.skeletonPage]}>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} style={styles.skeletonRow} />
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text selectable style={styles.muted}>
          {error.message}
        </Text>
      </View>
    );
  }

  const count = trades.length;

  return (
    <>
      <Stack.Screen
        options={{
          // Filters and sort are separate bar buttons (iOS Mail/Files pattern):
          // each a pull-down with checkmark groups, filter icon filled when active.
          headerLeft: () => (
            <View style={styles.headerButtons}>
              <TradeFilterMenu
                active={filtersActive}
                onReset={() => {
                  setStatus('all');
                  setDateFilter('all');
                  setMarket('all');
                }}
                // Ordered by how often a trader narrows on it: the date range
                // moves constantly, outcome less so, instrument rarely.
                groups={[
                  {
                    key: 'date',
                    title: t`Date`,
                    icon: 'calendar',
                    options: dateFilters,
                    value: dateFilter,
                    onChange: (v) => setDateFilter(v as DateFilter),
                  },
                  {
                    key: 'status',
                    title: t`Status`,
                    icon: 'flag',
                    options: filters,
                    value: status,
                    onChange: (v) => setStatus(v as StatusFilter),
                  },
                  {
                    key: 'market',
                    title: t`Market`,
                    icon: 'chart.bar',
                    options: markets,
                    value: market,
                    onChange: (v) => setMarket(v as MarketFilter),
                  },
                ]}
              />
              <TradeFilterMenu
                active={false}
                label={t`Sort`}
                systemImage="arrow.up.arrow.down"
                groups={[
                  {
                    // Single group — listed straight into the menu, so no
                    // submenu row exists to carry a title.
                    key: 'sort',
                    options: sortOrders,
                    value: sortOrder,
                    onChange: (v) => setSortOrder(v as SortOrder),
                  },
                ]}
              />
              <SearchToggle
                open={searching}
                active={search.trim().length > 0}
                label={t`Search symbol or tag`}
                onPress={() => {
                  if (searching) setSearch('');
                  setSearching((open) => !open);
                }}
              />
              <AccountMenu />
            </View>
          ),
        }}
      />
      {/* FlashList recycles row instances — TradeRow must stay stateless-from-props. */}
      <FlashList
        style={styles.page}
        data={trades}
        keyExtractor={(trade) => trade.id}
        renderItem={({ item }) => <SwipeableTradeRow trade={item} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        // FlashList lays rows out itself, so container `gap` can't space them.
        ItemSeparatorComponent={RowGap}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
        ListHeaderComponent={
          <View>
            <TagBar
              chips={chipDefs}
              counts={chipCounts}
              total={data?.length ?? 0}
              selected={activeChip}
              onSelect={setTagFilter}
              onManage={() => router.push('/manage-tags')}
            />
            {count > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryCount}>{t`${count} trades`.toUpperCase()}</Text>
                <Text style={styles.summaryLabel}>
                  {t`Net`}{' '}
                  <Text style={[styles.summaryNet, { color: pnlColor(theme.colors, netTotal) }]}>
                    {formatPnl(netTotal, trades[0]?.pnl_currency)}
                  </Text>
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.muted}>
              {search
                ? t`No trades matching "${search}"`
                : status !== 'all'
                  ? t`No trades match this filter.`
                  : t`No trades yet — import a broker CSV to get started.`}
            </Text>
          </View>
        }
      />
      <FloatingSearchBar
        open={searching}
        value={search}
        placeholder={t`Search symbol or tag`}
        onChangeText={setSearch}
        onClose={() => {
          setSearch('');
          setSearching(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
    paddingTop: theme.spacing.sm,
  },
  rowGap: { height: theme.spacing.md },
  skeletonPage: { flex: 1 },
  skeletonRow: {
    height: 76,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
  },
  tagBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  tagBarScroll: { flex: 1 },
  tagBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
    paddingHorizontal: 2,
  },
  // iOS 26 bordered capsule chips — border carries the affordance, not a fill.
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 26,
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
  tagChipLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.mutedForeground },
  tagChipCount: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
  tagManage: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  swipePressed: { opacity: 0.7 },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  // iOS section-header treatment: count left, labeled net right — no floating line.
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
  summaryCount: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
  summaryNet: { fontSize: 13, fontWeight: '600' },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  muted: { color: theme.colors.mutedForeground, textAlign: 'center' },
}));
