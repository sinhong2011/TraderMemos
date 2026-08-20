import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { cn, Skeleton } from 'panelui-native';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { useAccounts, useTags, useTrades } from '@/api/hooks';
import type { Trade } from '@/api/types';
import { ErrorState } from '@/components/error-state';
import { FloatingSearchBar, SearchToggle } from '@/components/search-bar';
import { SwipeableTradeRow } from '@/components/swipeable-trade-row';
import { TradeFilterMenu } from '@/components/trade-filter-menu';
import { t } from '@lingui/core/macro';
import { setSelectedAccountId, useSelectedAccountId } from '@/lib/account-store';
import { useGlobalFilters } from '@/lib/filters';
import { useFormatters } from '@/lib/format';
import { parseEmotionalStates } from '@/lib/journal';
import { useTagBarState } from '@/lib/tag-bar';
import { pnlClass } from '@/styles/pnl';

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
  return <View className="h-3" />;
}

/** iOS 26 bordered capsule chip — the border carries the affordance, not a fill. */
const TAG_CHIP =
  'min-h-[26px] flex-row items-center gap-1 rounded-full border border-border px-2.5 py-[3px] active:opacity-70';

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
  // The active wash is a computed rgba and the icon tint is a native prop, so
  // these three come off the tokens as values rather than as classes.
  const [primary, loss, mutedForeground] = useCSSVariable([
    '--color-primary',
    '--color-loss',
    '--color-muted-foreground',
  ]) as [string, string, string];
  const sorted = [...chips].sort((a, b) => (counts.get(b.key) ?? 0) - (counts.get(a.key) ?? 0));

  const chip = (key: string, label: string, count: number, neg: boolean) => {
    const active = selected === key;
    const color = neg ? loss : primary;
    return (
      <Pressable
        key={key}
        onPress={() => onSelect(key)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        className={TAG_CHIP}
        // Active state is background-only — border and text stay put.
        style={active ? { backgroundColor: `${color}26` } : undefined}
      >
        <Text className="text-xs font-medium text-muted-foreground" numberOfLines={1}>
          {label}
        </Text>
        <Text
          className="text-[11px] font-semibold tabular-nums text-muted-foreground"
          numberOfLines={1}
        >
          {count}
        </Text>
      </Pressable>
    );
  };

  return (
    <View className="flex-row items-center gap-2 pb-3">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="flex-row items-center gap-1.5 px-0.5"
      >
        {chip('all', t`All`, total, false)}
        {sorted.map((def) => chip(def.key, def.label, counts.get(def.key) ?? 0, def.neg))}
      </ScrollView>
      <Pressable
        onPress={onManage}
        accessibilityRole="button"
        accessibilityLabel={t`Manage tags`}
        className="h-[26px] w-[26px] items-center justify-center rounded-full border border-border active:opacity-70"
      >
        <Icon name="slider.horizontal.3" size={13} tintColor={mutedForeground} />
      </Pressable>
    </View>
  );
}

export default function TradesScreen() {
  // `FlashList` is not a core component Uniwind can take a `className` on, so
  // its page fill has to be a JS value.
  const [background] = useCSSVariable(['--color-background']) as [string];
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
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatPnl } = useFormatters();
  const { data: tags } = useTags();
  const { data: accounts } = useAccounts();
  const selectedAccountId = useSelectedAccountId();
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
  // The scope is app-wide state, so a deleted or still-loading account has to
  // fall back to "All accounts" rather than show an unmatched checkmark.
  const accountList = accounts ?? [];
  const scopedAccount =
    selectedAccountId != null && accountList.some((account) => account.id === selectedAccountId)
      ? selectedAccountId
      : 'all';
  const accountOptions = [
    { value: 'all', label: t`All accounts` },
    ...accountList.map((account) => ({ value: account.id, label: account.name })),
  ];
  // Sort is deliberately not in here: it reorders the list, it never hides a
  // trade, so it must not fill the icon or get swept up by "Clear filters".
  const filtersActive =
    status !== 'all' || dateFilter !== 'all' || market !== 'all' || scopedAccount !== 'all';

  if (isLoading) {
    // Row-shaped skeletons standing in for the trade list.
    return (
      <View className="flex-1 bg-background p-4 pb-12 pt-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton
            key={i}
            className="mb-3 h-[76px] rounded-lg"
            // One label for the whole list: eight announcements of the same
            // wait is what a screen of placeholders must not do.
            label={i === 0 ? t`Loading trades` : undefined}
          />
        ))}
      </View>
    );
  }

  // Before the filter chrome, not after: with no trades to filter, a header
  // full of live-looking pull-downs over an error is just noise. A failed
  // *refresh* over a warm cache is a different thing entirely — the list still
  // renders and the offline banner carries the bad news.
  if (error && data == null) {
    return <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />;
  }

  const count = trades.length;

  return (
    <>
      <Stack.Screen
        options={{
          // One pull-down for everything that shapes the list (iOS Mail/Files
          // pattern): account scope, the three filters and sort order, each its
          // own checkmark submenu, icon filled while anything narrows the list.
          // Three bar buttons for one job left the row crowded and made you
          // guess which pull-down held what.
          headerLeft: () => (
            <View className="flex-row items-center gap-2">
              <TradeFilterMenu
                active={filtersActive}
                onReset={() => {
                  setStatus('all');
                  setDateFilter('all');
                  setMarket('all');
                  setSelectedAccountId(null);
                }}
                // Ordered by how often a trader narrows on it: account scope
                // frames everything, the date range moves constantly, outcome
                // less so, instrument rarely. Sort trails the filters it sorts.
                groups={[
                  {
                    key: 'account',
                    title: t`Account`,
                    icon: 'person.crop.circle',
                    options: accountOptions,
                    value: scopedAccount,
                    // App-wide scope (see lib/account-store) — switching here
                    // also moves the dashboard and reports.
                    onChange: (v) => setSelectedAccountId(v === 'all' ? null : v),
                  },
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
                  {
                    key: 'sort',
                    title: t`Sort`,
                    icon: 'arrow.up.arrow.down',
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
            </View>
          ),
        }}
      />
      {/* FlashList recycles row instances — TradeRow must stay stateless-from-props. */}
      <FlashList
        style={{ backgroundColor: background }}
        data={trades}
        keyExtractor={(trade) => trade.id}
        renderItem={({ item }) => <SwipeableTradeRow trade={item} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 48 }}
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
            {/* iOS section-header treatment: count left, labeled net right —
                no floating line. */}
            {count > 0 ? (
              <View className="flex-row items-baseline justify-between gap-3 px-1 pb-3">
                <Text className="text-[11px] font-medium tracking-[0.6px] tabular-nums text-muted-foreground">
                  {t`${count} trades`.toUpperCase()}
                </Text>
                <Text className="text-xs font-medium tabular-nums text-muted-foreground">
                  {t`Net`}{' '}
                  <Text className={cn('text-[13px] font-semibold', pnlClass(netTotal))}>
                    {formatPnl(netTotal, trades[0]?.pnl_currency)}
                  </Text>
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View className="items-center justify-center gap-3 p-6">
            <Text className="text-center text-muted-foreground">
              {search
                ? t`No trades matching "${search}"`
                : status !== 'all'
                  ? t`No trades match this filter.`
                  : t`Tap + to log a trade, or import from Settings → Import trades.`}
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
