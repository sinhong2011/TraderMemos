import { ContentUnavailableView } from '@expo/ui/swift-ui';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useMarketBars } from '@/api/hooks';
import type { BarInterval } from '@/api/types';
import { AXIS_WIDTH, ChartCanvas } from '@/components/chart-canvas';
import { DashboardCard } from '@/components/dashboard-card';
import { InlineError } from '@/components/error-state';
import { FloatingSearchBar, SearchToggle } from '@/components/search-bar';
import { Segmented } from '@/components/segmented';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { storage } from '@/storage/mmkv';
import { AppHost } from '@/components/app-host';

type Market = 'stock' | 'crypto' | 'forex' | 'future';

type RangeKey = '1D' | '5D' | '1M' | '3M' | '1Y';

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

function loadRecents(): string[] {
  try {
    const raw = storage.getString(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/** Snap to the minute so the query key (and the server cache key) stays stable. */
function snapToMinute(ms: number): string {
  const d = new Date(ms);
  d.setSeconds(0, 0);
  return d.toISOString();
}

/**
 * Free-form market chart over the app's own /market/bars proxy — symbol from
 * the nav search bar (recents in MMKV), range presets, interval switch, and
 * the same bar-replay scrubber the trade chart uses (without P&L: there are
 * no fills here).
 */
export default function AdvancedChartScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const [symbol, setSymbol] = useState(() => loadRecents()[0] ?? '');
  const [pendingSymbol, setPendingSymbol] = useState('');
  const [searching, setSearching] = useState(false);
  const [market, setMarket] = useState<Market>('stock');
  const [range, setRange] = useState<RangeKey>('1M');
  const [interval, setBarInterval] = useState<BarInterval>('60');
  const [recents, setRecents] = useState<string[]>(loadRecents);
  // Captured once per mount so the query key doesn't churn between renders.
  const [nowMs] = useState(() => Date.now());

  function commitSymbol(raw: string) {
    const next = raw.trim().toUpperCase();
    if (!next) return;
    setSymbol(next);
    const nextRecents = [next, ...recents.filter((s) => s !== next)].slice(0, MAX_RECENTS);
    setRecents(nextRecents);
    storage.set(RECENTS_KEY, JSON.stringify(nextRecents));
  }

  function pickRange(next: RangeKey) {
    setRange(next);
    setBarInterval(RANGES[next].interval);
  }

  const bars = useMarketBars({
    symbol,
    instrumentType: market,
    interval,
    from: snapToMinute(nowMs - RANGES[range].ms),
    to: snapToMinute(nowMs),
  });
  const data = bars.data?.bars ?? [];

  const markets = [
    { value: 'stock' as const, label: t`Stock` },
    { value: 'crypto' as const, label: t`Crypto` },
    { value: 'forex' as const, label: t`Forex` },
    { value: 'future' as const, label: t`Futures` },
  ];
  const ranges = (Object.keys(RANGES) as RangeKey[]).map((key) => ({ value: key, label: key }));
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
          title: symbol || t`Chart`,
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
          <RefreshControl refreshing={bars.isRefetching} onRefresh={() => void bars.refetch()} />
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
              description={t`Search a ticker above to load its chart.`}
            />
          </AppHost>
        ) : (
          <DashboardCard
            title={symbol}
            control={<Segmented compact options={ranges} value={range} onChange={pickRange} />}
          >
            <Segmented options={markets} value={market} onChange={setMarket} />

            {bars.isLoading ? (
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
                        market,
                        interval,
                        from: String(nowMs - RANGES[range].ms),
                        to: String(nowMs),
                      },
                    })
                  }
                  disabled={data.length <= 1}
                  accessibilityRole="button"
                  accessibilityLabel={t`Replay ${symbol}`}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <ChartCanvas bars={data} interval={interval} />
                  {data.length > 1 ? (
                    <View style={styles.replayBadge}>
                      <SymbolView name="play.fill" size={10} tintColor={theme.colors.background} />
                      <Text style={styles.replayLabel}>{t`Replay`}</Text>
                    </View>
                  ) : null}
                </Pressable>
            )}

            {/* Interval sits under the candles it re-cuts, matching the trade
                chart card — and outside the branch above, since the empty state
                tells you to reach for it. */}
            <View style={styles.intervalRow}>
              <Segmented options={intervals} value={interval} onChange={setBarInterval} />
            </View>
          </DashboardCard>
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
}));
