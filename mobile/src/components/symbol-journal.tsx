import { ContentUnavailableView } from '@expo/ui/swift-ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';
import { useMarketBars, useTradeDetails, useTrades } from '@/api/hooks';
import type { BarInterval } from '@/api/types';
import {
  AXIS_WIDTH,
  ChartCanvas,
  type ChartMarker,
  type ChartPriceLine,
} from '@/components/chart-canvas';
import { DashboardCard } from '@/components/dashboard-card';
import { InlineError } from '@/components/error-state';
import { FloatingSearchBar, SearchToggle } from '@/components/search-bar';
import { Segmented } from '@/components/segmented';
import { Skeleton } from '@/components/skeleton';
import { TradeRow } from '@/components/trade-row';
import { t } from '@lingui/core/macro';
import { formatDuration, formatPercent, useFormatters } from '@/lib/format';
import { defaultInterval, snapToMinute } from '@/lib/trade-bars';
import { storage } from '@/storage/mmkv';
import { pnlColor } from '@/styles/unistyles';
import { AppHost } from '@/components/app-host';

type Market = 'stock' | 'crypto' | 'forex' | 'future';

type RangeKey = '1D' | '5D' | '1M' | '3M' | '1Y';

/** 'auto' frames first entry → last exit; the presets are the manual override. */
type RangeChoice = RangeKey | 'auto';

/** Window length and a sensible default interval per range. */
const RANGES: Record<RangeKey, { ms: number; interval: BarInterval }> = {
  '1D': { ms: 86_400_000, interval: '5' },
  '5D': { ms: 5 * 86_400_000, interval: '15' },
  '1M': { ms: 30 * 86_400_000, interval: '60' },
  '3M': { ms: 90 * 86_400_000, interval: '240' },
  '1Y': { ms: 365 * 86_400_000, interval: 'D' },
};

const RECENTS_KEY = 'chart:recent-symbols';
const MAX_RECENTS = 6;
const MAX_TRADE_ROWS = 30;

function loadRecents(): string[] {
  try {
    const raw = storage.getString(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/** Marker-label price — the 60pt label has no room for float noise. */
function markerPrice(value: number): string {
  return value >= 1000 ? value.toFixed(0) : String(Number(value.toFixed(2)));
}

function StatRow({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text selectable style={[styles.statValue, tint ? { color: tint } : null]}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Symbol journal — the chart of a symbol with *your* history drawn on it:
 * every entry and exit as an outcome-colored marker, the window framed around
 * your first entry → last exit, your record with the symbol, and the trades
 * themselves as rows. Symbols you never traded degrade to the plain lookup
 * chart (search, recents, market segment, tap-to-replay) this screen used to
 * be — see #212.
 *
 * Mounted from two stacks ((dashboard) via the Tools menu, (trades) via the
 * symbol chip on a trade) — both route files just re-export this screen.
 */
export default function SymbolJournalScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { formatPnl } = useFormatters();
  const params = useLocalSearchParams<{ symbol?: string; market?: string }>();
  const paramSymbol = params.symbol?.trim().toUpperCase() || undefined;

  const [symbol, setSymbol] = useState(() => paramSymbol ?? loadRecents()[0] ?? '');
  const [pendingSymbol, setPendingSymbol] = useState('');
  const [searching, setSearching] = useState(false);
  // A deep-linked symbol joins the recents the same way a searched one does.
  const [recents, setRecents] = useState<string[]>(() => {
    const base = loadRecents();
    if (!paramSymbol) return base;
    return [paramSymbol, ...base.filter((s) => s !== paramSymbol)].slice(0, MAX_RECENTS);
  });
  // Manual overrides; null falls back to what the trade history implies.
  const [marketChoice, setMarketChoice] = useState<Market | null>(null);
  const [rangeChoice, setRangeChoice] = useState<RangeChoice | null>(null);
  const [intervalChoice, setIntervalChoice] = useState<BarInterval | null>(null);
  // Captured once per mount so the query key doesn't churn between renders.
  const [nowMs] = useState(() => Date.now());

  // Persist the deep-link's promotion into MMKV — the state half was seeded in
  // the initializer above, so the effect only updates the external store.
  useEffect(() => {
    if (!paramSymbol) return;
    const next = [paramSymbol, ...loadRecents().filter((s) => s !== paramSymbol)].slice(
      0,
      MAX_RECENTS,
    );
    storage.set(RECENTS_KEY, JSON.stringify(next));
  }, [paramSymbol]);

  function commitSymbol(raw: string) {
    const next = raw.trim().toUpperCase();
    if (!next) return;
    setSymbol(next);
    setMarketChoice(null);
    setRangeChoice(null);
    setIntervalChoice(null);
    const nextRecents = [next, ...recents.filter((s) => s !== next)].slice(0, MAX_RECENTS);
    setRecents(nextRecents);
    storage.set(RECENTS_KEY, JSON.stringify(nextRecents));
  }

  const trades = useTrades({ symbol }, { enabled: symbol !== '' });
  const history = useMemo(
    () => (symbol === '' ? [] : (trades.data ?? [])),
    [symbol, trades.data],
  );

  /** First entry → last exit (open trades run to now), padded off the frame edge. */
  const historyWindow = useMemo(() => {
    if (history.length === 0) return null;
    let first = Infinity;
    let last = -Infinity;
    for (const trade of history) {
      const opened = new Date(trade.opened_at).getTime();
      const closed = trade.closed_at ? new Date(trade.closed_at).getTime() : nowMs;
      if (opened < first) first = opened;
      if (closed > last) last = closed;
    }
    const pad = Math.max((last - first) * 0.08, 3_600_000);
    return { fromMs: first - pad, toMs: Math.min(last + pad, nowMs) };
  }, [history, nowMs]);
  const hasHistory = historyWindow != null;

  // You told the app what this symbol is when you journalled it — the market
  // segment only shows for free-form lookups where nothing recorded it.
  const historyInstrument = useMemo(() => {
    const counts = new Map<string, number>();
    for (const trade of history) {
      counts.set(trade.instrument_type, (counts.get(trade.instrument_type) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [kind, count] of counts) {
      if (count > bestCount) {
        best = kind;
        bestCount = count;
      }
    }
    return best;
  }, [history]);
  const paramMarket = paramSymbol === symbol ? params.market : undefined;
  const instrumentType = marketChoice ?? historyInstrument ?? paramMarket ?? 'stock';

  const effectiveRange: RangeChoice = rangeChoice ?? (hasHistory ? 'auto' : '1M');
  const presetRange: RangeKey = effectiveRange === 'auto' ? '1M' : effectiveRange;
  const frame =
    effectiveRange === 'auto' && historyWindow
      ? historyWindow
      : { fromMs: nowMs - RANGES[presetRange].ms, toMs: nowMs };
  const interval =
    intervalChoice ??
    (effectiveRange === 'auto'
      ? defaultInterval(frame.fromMs, frame.toMs)
      : RANGES[presetRange].interval);

  // Until the history answers, the frame is unknown — hold the bars query so
  // the chart doesn't paint "1M from today" and then jump to the trades.
  const framing = symbol !== '' && rangeChoice == null && trades.isLoading;

  const bars = useMarketBars({
    symbol: framing ? '' : symbol,
    instrumentType,
    interval,
    from: snapToMinute(frame.fromMs),
    to: snapToMinute(frame.toMs),
  });
  const data = bars.data?.bars ?? [];

  // Fills per trade, shared with the detail screens' cache. Only the visible
  // rows are fetched — for older trades the avg-entry/exit fallback below
  // still marks the chart.
  const visibleIds = useMemo(
    () => history.slice(0, MAX_TRADE_ROWS).map((trade) => trade.id),
    [history],
  );
  const details = useTradeDetails(visibleIds);

  // Every fill on this symbol, colored by how its trade ended. Real fills
  // where the detail has arrived (a scale-in shows each add, not one averaged
  // arrow); the trade's avg entry/exit until then. Keys carry the trade id so
  // a marker tap can open the trade.
  const markers = useMemo<ChartMarker[]>(() => {
    return history.flatMap((trade) => {
      const outcome =
        trade.status === 'closed' ? pnlColor(theme.colors, trade.net_pnl) : undefined;
      const fills = details.get(trade.id)?.fills;
      if (fills && fills.length > 0) {
        return fills.map((fill) => ({
          key: `${trade.id}|${fill.id}`,
          timeSec: Math.floor(new Date(fill.executed_at).getTime() / 1000),
          isBuy: fill.side === 'buy',
          label: `${fill.quantity} @ ${markerPrice(fill.price)}`,
          color: outcome,
        }));
      }
      const marks: ChartMarker[] = [
        {
          key: `${trade.id}|entry`,
          timeSec: Math.floor(new Date(trade.opened_at).getTime() / 1000),
          isBuy: trade.direction === 'long',
          label: `${trade.qty_opened} @ ${markerPrice(trade.avg_entry_price)}`,
          color: outcome,
        },
      ];
      if (trade.closed_at && trade.avg_exit_price != null) {
        marks.push({
          key: `${trade.id}|exit`,
          timeSec: Math.floor(new Date(trade.closed_at).getTime() / 1000),
          isBuy: trade.direction !== 'long',
          label: `${trade.qty_opened} @ ${markerPrice(trade.avg_exit_price)}`,
          color: outcome,
        });
      }
      return marks;
    });
  }, [history, details, theme.colors]);

  // Open positions draw their cost basis across the chart — "your level" is
  // the one line a broker chart can't know.
  const priceLines = useMemo<ChartPriceLine[]>(
    () =>
      history
        .filter((trade) => trade.status === 'open')
        .map((trade) => ({ value: trade.avg_entry_price, color: theme.colors.primary })),
    [history, theme.colors],
  );

  // Folded client-side from the rows already fetched for the list below —
  // money per currency, since accounts can settle in different ones.
  const record = useMemo(() => {
    if (history.length === 0) return null;
    const closed = history.filter((trade) => trade.status === 'closed');
    const wins = closed.filter((trade) => (trade.net_pnl ?? 0) > 0).length;
    const netByCurrency = new Map<string, number>();
    for (const trade of closed) {
      netByCurrency.set(
        trade.pnl_currency,
        (netByCurrency.get(trade.pnl_currency) ?? 0) + (trade.net_pnl ?? 0),
      );
    }
    const holds = closed
      .map((trade) => trade.time_in_trade_secs)
      .filter((secs): secs is number => secs != null);
    return {
      total: history.length,
      open: history.length - closed.length,
      closedCount: closed.length,
      winRate: closed.length > 0 ? wins / closed.length : null,
      net: [...netByCurrency.entries()],
      avgHoldSecs:
        holds.length > 0 ? holds.reduce((sum, secs) => sum + secs, 0) / holds.length : null,
    };
  }, [history]);

  const markets = [
    { value: 'stock' as const, label: t`Stock` },
    { value: 'crypto' as const, label: t`Crypto` },
    { value: 'forex' as const, label: t`Forex` },
    { value: 'future' as const, label: t`Futures` },
  ];
  const segmentMarket: Market = (['stock', 'crypto', 'forex', 'future'] as const).includes(
    instrumentType as Market,
  )
    ? (instrumentType as Market)
    : 'stock';
  const ranges: { value: RangeChoice; label: string }[] = [
    ...(hasHistory ? [{ value: 'auto' as const, label: t`Auto` }] : []),
    ...(Object.keys(RANGES) as RangeKey[]).map((key) => ({ value: key, label: key })),
  ];
  const intervals: { value: BarInterval; label: string }[] = [
    { value: '1', label: '1m' },
    { value: '5', label: '5m' },
    { value: '15', label: '15m' },
    { value: '60', label: '1H' },
    { value: '240', label: '4H' },
    { value: 'D', label: '1D' },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: symbol || t`Symbol journal`,
          headerLargeTitle: false,
          headerRight: () => (
            <SearchToggle
              open={searching}
              active={false}
              label={t`Search symbol`}
              onPress={() => {
                if (searching) setPendingSymbol('');
                setSearching((open) => !open);
              }}
            />
          ),
        }}
      />
      <ScrollView
        style={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={bars.isRefetching || trades.isRefetching}
            onRefresh={() => {
              void bars.refetch();
              void trades.refetch();
            }}
          />
        }
      >
        {recents.length > 0 ? (
          <View style={styles.recents}>
            {recents.map((recent) => (
              <Pressable
                key={recent}
                onPress={() => commitSymbol(recent)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.recentChip,
                  recent === symbol && styles.recentChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.recentLabel, recent === symbol && styles.recentLabelActive]}
                >
                  {recent}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {symbol === '' ? (
          <AppHost style={styles.emptyHost}>
            <ContentUnavailableView
              title={t`Pick a symbol`}
              systemImage="chart.xyaxis.line"
              description={t`Search a ticker to see its chart — with your own trades drawn on it.`}
            />
          </AppHost>
        ) : (
          <>
            <DashboardCard
              title={symbol}
              control={
                <Segmented
                  compact
                  options={ranges}
                  value={effectiveRange}
                  onChange={(next) => {
                    setRangeChoice(next);
                    setIntervalChoice(null);
                  }}
                />
              }
            >
              {!framing && !hasHistory ? (
                <Segmented options={markets} value={segmentMarket} onChange={setMarketChoice} />
              ) : null}

              {framing || bars.isLoading ? (
                <Skeleton style={styles.placeholder} />
              ) : bars.error && bars.data == null ? (
                <InlineError error={bars.error} onRetry={() => void bars.refetch()} />
              ) : data.length === 0 ? (
                <View style={styles.placeholder}>
                  <Text style={styles.empty}>
                    {t`No bars for ${symbol} in this window — try a coarser interval.`}
                  </Text>
                </View>
              ) : (
                // Tapping the plot plays it back, same affordance as the trade
                // chart — the replay itself is the full-screen route.
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/replay',
                      params: {
                        symbol,
                        market: instrumentType,
                        interval,
                        from: String(frame.fromMs),
                        to: String(frame.toMs),
                      },
                    })
                  }
                  disabled={data.length <= 1}
                  accessibilityRole="button"
                  accessibilityLabel={t`Replay ${symbol}`}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <ChartCanvas
                    bars={data}
                    interval={interval}
                    markers={markers}
                    priceLines={priceLines}
                    // A fill answers to its trade: tapping the marker opens it.
                    onMarkerPress={(key) => {
                      const tradeId = key.split('|')[0];
                      router.push({
                        pathname: '/(tabs)/(trades)/[id]',
                        params: { id: tradeId },
                      });
                    }}
                  />
                  {data.length > 1 ? (
                    <View style={styles.replayBadge}>
                      <Icon
                        name="play.fill"
                        size={10}
                        tintColor={theme.colors.background}
                      />
                      <Text style={styles.replayLabel}>{t`Replay`}</Text>
                    </View>
                  ) : null}
                </Pressable>
              )}

              {/* Interval sits under the candles it re-cuts, matching the trade
                  chart card — and outside the branch above, since the empty state
                  tells you to reach for it. */}
              <View style={styles.intervalRow}>
                <Segmented options={intervals} value={interval} onChange={setIntervalChoice} />
              </View>
            </DashboardCard>

            {record ? (
              <DashboardCard title={t`Your record`}>
                {record.net.map(([currency, net]) => (
                  <StatRow
                    key={currency}
                    label={record.net.length > 1 ? t`Net P&L (${currency})` : t`Net P&L`}
                    value={formatPnl(net, currency)}
                    tint={pnlColor(theme.colors, net)}
                  />
                ))}
                <StatRow
                  label={t`Win rate`}
                  value={
                    record.winRate != null
                      ? formatPercent(record.winRate, 0)
                      : t`No closed trades`
                  }
                />
                <StatRow
                  label={t`Trades`}
                  value={
                    record.open > 0
                      ? t`${record.total} · ${record.open} open`
                      : String(record.total)
                  }
                />
                {record.avgHoldSecs != null ? (
                  <StatRow label={t`Avg hold`} value={formatDuration(record.avgHoldSecs)} />
                ) : null}
              </DashboardCard>
            ) : null}

            {history.length > 0 ? (
              <DashboardCard title={t`Your trades`} flush>
                <View style={styles.tradeRows}>
                  {history.slice(0, MAX_TRADE_ROWS).map((trade) => (
                    <TradeRow key={trade.id} trade={trade} />
                  ))}
                </View>
                {history.length > MAX_TRADE_ROWS ? (
                  <Text style={styles.footnote}>
                    {t`The ${MAX_TRADE_ROWS} most recent of ${history.length} trades.`}
                  </Text>
                ) : null}
              </DashboardCard>
            ) : null}
          </>
        )}
      </ScrollView>
      <FloatingSearchBar
        open={searching}
        value={pendingSymbol}
        placeholder={t`Symbol, e.g. SPY`}
        autoCapitalize="characters"
        onChangeText={setPendingSymbol}
        // A ticker field commits on return rather than filtering as you type —
        // close the bar once it lands so the chart it just loaded is visible.
        onSubmit={() => {
          commitSymbol(pendingSymbol);
          setPendingSymbol('');
          setSearching(false);
        }}
        onClose={() => {
          setPendingSymbol('');
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
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 2,
  },
  recents: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  recentChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  recentChipActive: { backgroundColor: theme.colors.card, borderColor: theme.colors.input },
  pressed: { opacity: 0.6 },
  recentLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.mutedForeground },
  recentLabelActive: { color: theme.colors.foreground, fontWeight: '600' },
  placeholder: { height: 220, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 13, color: theme.colors.mutedForeground },
  emptyHost: { minHeight: 320 },
  intervalRow: { alignItems: 'center' },
  replayBadge: {
    position: 'absolute',
    top: 0,
    // Clear of the price gutter, so the badge never covers an axis label.
    right: AXIS_WIDTH + 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.foreground,
  },
  replayLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.background },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  statLabel: { fontSize: 15, color: theme.colors.mutedForeground },
  statValue: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.foreground,
    ...theme.numeric,
  },
  tradeRows: { gap: theme.spacing.sm },
  footnote: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    paddingHorizontal: theme.spacing.xs,
  },
}));
