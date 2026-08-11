// See the note in trade-form.tsx: @expo/ui's SwiftUI pager swallows taps on RN
// views inside its pages, which killed day-cell selection on these boards.
import PagerView from 'react-native-pager-view';
import { Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  ReduceMotion,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-screens/experimental';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Trade } from '@/api/types';
import { useAccounts, useCash, useDaily, useEquityCurve, useTrades } from '@/api/hooks';
import { ErrorState } from '@/components/error-state';
import { Segmented } from '@/components/segmented';
import { Skeleton } from '@/components/skeleton';
import { WeekPnlStrip } from '@/components/week-pnl-strip';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { useSelectedAccountId } from '@/lib/account-store';
import {
  monthGrid,
  monthWeekendColumnsVisible,
  periodStartBalance,
  tradeDayKey,
  weekVisibleDayKeys,
} from '@/lib/calendar';
import { netDeposits } from '@/lib/cash';
import { dayBounds, useGlobalFilters } from '@/lib/filters';
import { formatPercent, formatPercentPoints, formatRatio, useFormatters } from '@/lib/format';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency, resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';
import { pnlBgTint, pnlColor, pnlDotTint } from '@/styles/unistyles';

type Mode = 'week' | 'month' | 'year';

/**
 * Semantic board transitions. Mode switches read as zooming through the
 * year → month → week hierarchy (drill in = board rises toward you, drill
 * out = it settles back). Horizontal paging is the native pager's own
 * finger-tracked scroll, not a remount animation.
 */
type BoardAnim = 'drillIn' | 'drillOut';

/** week is the closest zoom level, year the farthest. */
const MODE_DEPTH: Record<Mode, number> = { week: 2, month: 1, year: 0 };

const EASE = { duration: 180, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

const boardEntering: Record<BoardAnim, EntryExitAnimationFunction> = {
  drillIn: () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ scale: 0.97 }] },
      animations: { opacity: withTiming(1, EASE), transform: [{ scale: withTiming(1, EASE) }] },
    };
  },
  drillOut: () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ scale: 1.03 }] },
      animations: { opacity: withTiming(1, EASE), transform: [{ scale: withTiming(1, EASE) }] },
    };
  },
};

/** Outgoing mode's board: shrink-fade under the incoming zoom. */
const boardExiting: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: {
      opacity: withTiming(0, EASE),
      transform: [{ scale: withTiming(0.98, EASE) }],
    },
  };
};

/** `anchor` moved by `delta` pages of the given mode. */
function pageAnchor(mode: Mode, anchor: string, delta: number): string {
  const d = new Date(`${anchor}T00:00:00Z`);
  if (mode === 'week') d.setUTCDate(d.getUTCDate() + delta * 7);
  else if (mode === 'month') d.setUTCMonth(d.getUTCMonth() + delta);
  else d.setUTCFullYear(d.getUTCFullYear() + delta);
  return keyOf(d);
}

/** The pager's steady 3-page window centered on `anchor`. */
function pageWindow(mode: Mode, anchor: string): [string, string, string] {
  return [pageAnchor(mode, anchor, -1), anchor, pageAnchor(mode, anchor, 1)];
}

/** Two frames — one isn't enough for a React commit to reach SwiftUI. */
function afterFlush(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

/** The wheel card drops in from under the nav bar and settles. */
const panelEntering: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: -8 }, { scale: 0.97 }] },
    animations: {
      opacity: withTiming(1, EASE),
      transform: [{ translateY: withTiming(0, EASE) }, { scale: withTiming(1, EASE) }],
    },
  };
};

/** Per-day closed-trade tallies (close basis) behind the count and W/L badges. */
type DayStats = { count: number; wins: number; losses: number };

/** Closed-trade edge metrics for one calendar week — mirrors web day/week review stats. */
type WeekTradeStats = {
  winRate: number;
  profitFactor: number;
  expectancy: number;
};

function weekTradeStats(trades: Trade[], weekKeys: readonly string[]): WeekTradeStats {
  const keys = new Set(weekKeys);
  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let total = 0;
  for (const trade of trades) {
    const key = tradeDayKey(trade);
    if (key == null || !keys.has(key)) continue;
    total += 1;
    const pnl = trade.net_pnl ?? 0;
    if (pnl > 0) {
      wins += 1;
      grossProfit += pnl;
    } else if (pnl < 0) {
      losses += 1;
      grossLoss += -pnl;
    }
  }
  const winRate = total > 0 ? wins / total : 0;
  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0;
  const lossRate = total > 0 ? losses / total : 0;
  return {
    winRate,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0,
    expectancy: Math.round((winRate * avgWin - lossRate * avgLoss) * 100) / 100,
  };
}

/** Compact win-rate / PF / expectancy row plus optional balance walk. */
function WeekStatsBlock({
  stats,
  currency,
  startBalance,
  endBalance,
  showBalance,
}: {
  stats: WeekTradeStats;
  currency: string;
  startBalance: number | null;
  endBalance: number | null;
  showBalance: boolean;
}) {
  const { theme } = useUnistyles();
  const { formatPnl, formatCurrency } = useFormatters();
  const expTint = pnlColor(theme.colors, stats.expectancy);

  return (
    <View style={styles.weekStats}>
      <View style={styles.weekStatsRow}>
        <View style={styles.weekStatCell}>
          <Text style={styles.weekStatLabel}>{t`Win rate`}</Text>
          <Text style={styles.weekStatValue}>{formatPercent(stats.winRate, 0)}</Text>
        </View>
        <View style={styles.weekStatCell}>
          <Text style={styles.weekStatLabel}>{t`Profit factor`}</Text>
          <Text style={styles.weekStatValue}>{formatRatio(stats.profitFactor)}</Text>
        </View>
        <View style={styles.weekStatCell}>
          <Text style={styles.weekStatLabel}>{t`Expectancy`}</Text>
          <Text style={[styles.weekStatValue, { color: expTint }]}>
            {formatPnl(stats.expectancy, currency)}
          </Text>
        </View>
      </View>
      {showBalance && startBalance != null && endBalance != null ? (
        <Text style={styles.weekStatBalance} numberOfLines={1} adjustsFontSizeToFit>
          {`${formatCurrency(startBalance, currency)} → ${formatCurrency(endBalance, currency)}`}
        </Text>
      ) : null}
    </View>
  );
}

/** Sun-first short weekday names in the app locale. */
const DOW = (() => {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2023, 0, 1 + i))));
})();

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** The Sunday starting the week containing `key`. */
function weekStart(key: string): Date {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

/**
 * Full P&L calendar with the web app's month/year views plus a phone week
 * view. One anchor date drives all three modes; daily P&L is fetched for the
 * anchor's whole year so mode switches never refetch. Tapping a day opens
 * its trades in a form sheet (day/[date]) rather than expanding inline.
 *
 * The screen is a no-scroll fit: every control lives in the compact nav bar
 * (period label as title, pull-down mode menu, pager chevrons) and the grid
 * flexes to fill whatever height remains.
 */
export default function CalendarScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const [mode, setMode] = useState<Mode>('month');
  const [anchor, setAnchor] = useState(todayKey);
  // The three pager panes' periods. Managed separately from `anchor` so the
  // recenter can move through its intermediate duplicated-pane step.
  const [pages, setPages] = useState<[string, string, string]>(() =>
    pageWindow('month', todayKey),
  );
  const [anim, setAnim] = useState<BoardAnim>('drillIn');
  // Apple-Calendar-style period picker: the nav title toggles a floating
  // wheel card; the board stays live behind it so spinning pages in place.
  const [pickerOpen, setPickerOpen] = useState(false);
  // Finger-tracked paging: a 3-page native pager windowed on [prev, current,
  // next] that re-centers after every settle, so the timeline is endless.
  const pagerRef = useRef<PagerView>(null);

  const anchorDate = new Date(`${anchor}T00:00:00Z`);
  const year = anchorDate.getUTCFullYear();
  const month = anchorDate.getUTCMonth() + 1;

  // Neighbor years included so the pager's off-screen pages (Dec↔Jan edges,
  // year mode) render populated instead of blank while you drag.
  const globalFilters = useGlobalFilters();
  const daily = useDaily({
    ...globalFilters,
    from: `${year - 1}-01-01T00:00:00Z`,
    to: `${year + 2}-01-01T00:00:00Z`,
  });
  const trades = useTrades(globalFilters);
  const accounts = useAccounts();
  const cash = useCash();
  const equity = useEquityCurve(globalFilters);
  const selectedAccountId = useSelectedAccountId();
  const { marketTimezone } = useDisplayPrefs();
  const marketTz = resolveMarketTimezone(marketTimezone);
  const baseCurrency = accountBaseCurrency(accounts.data, selectedAccountId);
  const fx = useMoneyFx(baseCurrency);
  const currency = fx.currency;
  const fxRate = fx.rate ?? 1;
  const dayStats = useMemo(() => {
    const stats = new Map<string, DayStats>();
    for (const trade of trades.data ?? []) {
      const key = tradeDayKey(trade);
      if (!key) continue;
      const s = stats.get(key) ?? { count: 0, wins: 0, losses: 0 };
      s.count += 1;
      if ((trade.net_pnl ?? 0) > 0) s.wins += 1;
      else if ((trade.net_pnl ?? 0) < 0) s.losses += 1;
      stats.set(key, s);
    }
    return stats;
  }, [trades.data]);

  // Icons mirror each view's actual shape: day rows, month grid, mini-month grid.
  const modes = [
    { value: 'week' as const, label: t`Week`, icon: 'list.bullet' as const },
    { value: 'month' as const, label: t`Month`, icon: 'calendar' as const },
    { value: 'year' as const, label: t`Year`, icon: 'square.grid.3x3' as const },
  ];

  function switchMode(next: Mode, nextAnchor: string = anchor) {
    setAnim(MODE_DEPTH[next] > MODE_DEPTH[mode] ? 'drillIn' : 'drillOut');
    setMode(next);
    setAnchor(nextAnchor);
    setPages(pageWindow(next, nextAnchor));
    setPickerOpen(false);
    // The remounted pager starts centered; forget any in-flight page state.
    settledPage.current = 1;
    recentering.current = false;
  }

  const selectWeek = (date: string) => switchMode('week', date);

  const pagerLabel =
    mode === 'year'
      ? String(year)
      : mode === 'month'
        ? // Short month: the segmented mode control + pagers leave the title
          // only the middle sliver of the bar.
          anchorDate.toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' })
        : (() => {
            const start = weekStart(anchor);
            const end = new Date(start);
            end.setUTCDate(end.getUTCDate() + 6);
            const opt = { month: 'short', day: 'numeric', timeZone: 'UTC' } as const;
            return `${start.toLocaleDateString(locale, opt)} – ${end.toLocaleDateString(locale, opt)}`;
          })();

  // FX-scale the day map once here — every board below formats from it.
  const data = useMemo(() => {
    const raw = daily.data ?? {};
    if (fxRate === 1) return raw;
    return Object.fromEntries(Object.entries(raw).map(([key, pnl]) => [key, pnl * fxRate]));
  }, [daily.data, fxRate]);
  const equityPoints = useMemo(() => {
    const raw = equity.data?.points ?? [];
    if (fxRate === 1) return raw;
    return raw.map((p) => ({ ...p, equity: p.equity * fxRate }));
  }, [equity.data?.points, fxRate]);
  const deposits =
    netDeposits(accounts.data ?? [], selectedAccountId, cash.data ?? []) * fxRate;
  const equityLoaded = equity.data !== undefined;
  const balanceAtPeriodStart = useMemo(
    () => (dayKey: string) => {
      const { from } = dayBounds(dayKey, marketTz);
      return periodStartBalance(equityPoints, from, deposits);
    },
    [deposits, equityPoints, marketTz],
  );
  const openDay = (date: string) => router.push(`/(tabs)/(calendar)/day/${date}`);

  // Flicker-free infinite paging. Landing on a side page kicks off a
  // three-step recenter in which no on-screen pane ever changes content:
  // 1. duplicate the landed period into the (off-screen) center pane;
  // 2. after that commit reaches SwiftUI, jump to the center — a no-op to the
  //    eye because both panes are pixel-identical;
  // 3. rebuild the steady [prev, current, next] window, touching only the
  //    off-screen side panes.
  // The shift waits for the idle scroll state: onPageSelected fires the
  // moment the target page changes (mid gesture), and re-anchoring while the
  // native scroll is still settling compounds leftover momentum.
  const settledPage = useRef(1);
  const recentering = useRef(false);
  function onPageSelected(event: { nativeEvent: { position: number } }) {
    settledPage.current = event.nativeEvent.position;
  }
  function onPageScrollStateChanged(event: {
    nativeEvent: { pageScrollState: 'idle' | 'dragging' | 'settling' };
  }) {
    if (event.nativeEvent.pageScrollState !== 'idle') return;
    const pos = settledPage.current;
    settledPage.current = 1;
    if (pos === 1 || recentering.current) return;
    recentering.current = true;
    const landed = pos === 2 ? pages[2] : pages[0];
    setAnchor(landed);
    setPages((w) => (pos === 2 ? [w[0], w[2], w[2]] : [w[0], w[0], w[2]]));
    afterFlush(() => {
      pagerRef.current?.setPageWithoutAnimation(1);
      afterFlush(() => {
        setPages((w) => pageWindow(mode, w[1]));
        recentering.current = false;
      });
    });
  }

  /** Direct jump from the header pickers. */
  function jumpTo(y: number, m: number) {
    const key = `${y}-${pad(m)}-01`;
    if (key === anchor) return;
    setAnchor(key);
    setPages(pageWindow(mode, key));
  }

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    // 2023-01 anchors a stable base date; only the localized name matters.
    label: new Date(Date.UTC(2023, i, 1)).toLocaleDateString(locale, {
      month: 'long',
      timeZone: 'UTC',
    }),
  }));
  // Next year down through ten back, always including the viewed year.
  const nowYear = now.getFullYear();
  const yearRange = Array.from({ length: 12 }, (_, i) => nowYear + 1 - i);
  if (!yearRange.includes(year)) yearRange.push(year);
  const yearOptions = yearRange
    .sort((a, b) => b - a)
    .map((y) => ({ value: String(y), label: String(y) }));

  return (
    <>
      <Stack.Screen
        options={{
          // View-mode segmented control holds the bar's center; the period
          // lives on the left — a tappable wheel-card toggle in month/year
          // modes, a plain range label in week mode.
          headerTitle: () => (
            <Segmented compact options={modes} value={mode} onChange={switchMode} />
          ),
          headerLeft: () =>
            mode === 'week' ? (
              <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>
                {pagerLabel}
              </Text>
            ) : (
              <Pressable
                onPress={() => setPickerOpen((open) => !open)}
                hitSlop={8}
                accessibilityRole="button"
                style={({ pressed }) => [styles.headerTitleButton, pressed && styles.pressed]}
              >
                <Text
                  style={[styles.headerTitle, pickerOpen && { color: theme.colors.accent }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {pagerLabel}
                </Text>
              </Pressable>
            ),
          headerRight: () => (
            <View style={styles.pagerButtons}>
              <Pressable
                onPress={() => pagerRef.current?.setPage(0)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t`Previous`}
                style={({ pressed }) => [styles.pagerButton, pressed && styles.pressed]}
              >
                <SymbolView name="chevron.left" size={15} tintColor={theme.colors.foreground} />
              </Pressable>
              <Pressable
                onPress={() => pagerRef.current?.setPage(2)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t`Next`}
                style={({ pressed }) => [styles.pagerButton, pressed && styles.pressed]}
              >
                <SymbolView name="chevron.right" size={15} tintColor={theme.colors.foreground} />
              </Pressable>
            </View>
          ),
        }}
      />
      {/* Exact-fit screen: react-native-screens' SafeAreaView knows the transparent
          header + floating tab bar overlap (the tab trigger sets
          disableAutomaticContentInsets), so flexed rows can split the true visible
          height — the ScrollView remains only as a pull-to-refresh host. */}
      <SafeAreaView style={styles.page} edges={{ top: true, bottom: true }}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={daily.isRefetching}
              onRefresh={() => void Promise.all([daily.refetch(), trades.refetch()])}
            />
          }
        >
        {
          /* Mode switches remount the pager with the zoom transition; within a
             mode the native pager owns horizontal motion — boards track the
             finger and snap, no remount involved. Boards are absolute layers
             inside a flexed host so the leaving mode crossfades on top of the
             entering one instead of holding a layout slot and shoving it down.
             While the daily query loads, the skeleton overlays the pager
             rather than replacing it — swapping mounts made the pager's first
             layout pass (three unsized panes) flash on screen. */
          <View style={styles.boardHost}>
            <Animated.View
              key={mode}
              entering={boardEntering[anim]}
              exiting={boardExiting}
              style={styles.boardLayer}
            >
              <PagerView
                ref={pagerRef}
                initialPage={1}
                style={styles.fill}
                onPageSelected={onPageSelected}
                onPageScrollStateChanged={onPageScrollStateChanged}
              >
                {pages.map((pageKey, pane) => {
                  const pageDate = new Date(`${pageKey}T00:00:00Z`);
                  const pageYear = pageDate.getUTCFullYear();
                  return (
                    <View key={pane} style={styles.fill}>
                      {mode === 'month' ? (
                        <MonthView
                          year={pageYear}
                          month={pageDate.getUTCMonth() + 1}
                          data={data}
                          dayStats={dayStats}
                          todayKey={todayKey}
                          onSelect={openDay}
                          onSelectWeek={selectWeek}
                          currency={currency}
                          equityLoaded={equityLoaded}
                          balanceAtPeriodStart={balanceAtPeriodStart}
                        />
                      ) : mode === 'week' ? (
                        <WeekView
                          anchor={pageKey}
                          data={data}
                          dayStats={dayStats}
                          trades={trades.data ?? []}
                          todayKey={todayKey}
                          onSelect={openDay}
                          currency={currency}
                          equityLoaded={equityLoaded}
                          balanceAtPeriodStart={balanceAtPeriodStart}
                        />
                      ) : (
                        <YearView
                          year={pageYear}
                          data={data}
                          dayStats={dayStats}
                          currency={currency}
                          equityLoaded={equityLoaded}
                          yearStartBalance={balanceAtPeriodStart(`${pageYear}-01-01`)}
                          onSelectMonth={(m) => {
                            const key = `${pageYear}-${pad(m)}-01`;
                            setAnim('drillIn');
                            setAnchor(key);
                            setPages(pageWindow('month', key));
                            setMode('month');
                          }}
                        />
                      )}
                    </View>
                  );
                })}
              </PagerView>
            </Animated.View>
            {daily.isLoading ? (
              <Animated.View
                exiting={FadeOut.duration(150)}
                style={[styles.boardLayer, styles.skeletonOverlay]}
              >
                <BoardSkeleton />
              </Animated.View>
            ) : daily.error && daily.data == null ? (
              // The board is built from a P&L map, and an absent map draws the
              // same grid of flat zero-cells a genuinely flat month does. That
              // is the one failure mode worth an opaque overlay: a calendar
              // quietly claiming you broke even every day is worse than no
              // calendar. Same layer as the skeleton, so the header pager and
              // pull-to-refresh keep working behind it.
              <View style={[styles.boardLayer, styles.skeletonOverlay]}>
                <ErrorState
                  error={daily.error}
                  onRetry={() => void daily.refetch()}
                  retrying={daily.isRefetching}
                />
              </View>
            ) : null}
          </View>
        }
        </ScrollView>
        {pickerOpen ? (
          <>
            {/* Scrim closes the picker; kept light so the live board reads through. */}
            <Pressable style={styles.pickerScrim} onPress={() => setPickerOpen(false)} />
            <Animated.View
              entering={panelEntering}
              exiting={FadeOut.duration(120)}
              style={[styles.pickerCard, mode === 'year' && styles.pickerCardNarrow]}
            >
              {mode === 'month' ? (
                <Segmented
                  variant="wheel"
                  options={monthOptions}
                  value={String(month)}
                  onChange={(m) => jumpTo(year, Number(m))}
                />
              ) : null}
              <Segmented
                variant="wheel"
                options={yearOptions}
                value={String(year)}
                onChange={(y) => jumpTo(Number(y), month)}
              />
            </Animated.View>
          </>
        ) : null}
      </SafeAreaView>
    </>
  );
}

/** Month-board-shaped placeholder while the daily P&L query loads. */
function BoardSkeleton() {
  return (
    <View style={styles.fill}>
      <View style={styles.summaryRow}>
        <View style={styles.skeletonSummary}>
          <Skeleton style={styles.skeletonLabel} />
          <Skeleton style={styles.skeletonValue} />
        </View>
        <Skeleton style={styles.skeletonSide} />
      </View>
      {Array.from({ length: 5 }, (_, row) => (
        <View key={row} style={[styles.gridRow, styles.gridRowFlex]}>
          {Array.from({ length: 6 }, (_, col) => (
            <Skeleton key={col} style={styles.skeletonCell} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** "3W 2L" fragment — wins in profit color, losses in loss color, zeros omitted. */
function WinLoss({ wins, losses, style }: { wins: number; losses: number; style?: object }) {
  const { theme } = useUnistyles();
  if (wins === 0 && losses === 0) return null;
  return (
    <Text style={[styles.wl, style]} numberOfLines={1}>
      {wins > 0 ? <Text style={{ color: theme.colors.profit }}>{wins}W</Text> : null}
      {wins > 0 && losses > 0 ? ' ' : null}
      {losses > 0 ? <Text style={{ color: theme.colors.loss }}>{losses}L</Text> : null}
    </Text>
  );
}

function DayCell({
  date,
  pnl,
  stats,
  maxAbs,
  todayKey,
  onSelect,
  currency,
}: {
  date: string;
  pnl: number | null;
  stats: DayStats | undefined;
  maxAbs: number;
  todayKey: string;
  onSelect: (date: string) => void;
  currency: string;
}) {
  const { theme } = useUnistyles();
  const { formatPnlCompact } = useFormatters();
  const hasPnl = pnl != null;
  const isToday = date === todayKey;
  const count = stats?.count ?? 0;

  return (
    <Pressable
      disabled={!hasPnl}
      onPress={() => onSelect(date)}
      style={({ pressed }) => [
        styles.cell,
        hasPnl
          ? { backgroundColor: pnlBgTint(theme.colors, pnl!, maxAbs) }
          : styles.emptyCell,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.dayNum,
          hasPnl && !isToday && styles.dayNumOnTint,
          isToday && { color: theme.colors.accent, fontWeight: '700' },
        ]}
      >
        {Number(date.slice(8, 10))}
      </Text>
      {hasPnl ? (
        <View style={styles.cellBody}>
          <Text
            style={[styles.cellPnl, { color: pnlColor(theme.colors, pnl) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatPnlCompact(pnl, currency)}
          </Text>
          {count > 0 ? (
            <Text style={styles.cellSub} numberOfLines={1} adjustsFontSizeToFit>
              {/* Hermes has no Intl.PluralRules, so lingui's plural() crashes — branch by hand. */}
              {count === 1 ? t`1 trade` : t`${count} trades`}
            </Text>
          ) : null}
          <WinLoss wins={stats?.wins ?? 0} losses={stats?.losses ?? 0} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** Month board: weekday tiles plus a full-size weekly summary column. */
function MonthView({
  year,
  month,
  data,
  dayStats,
  todayKey,
  onSelect,
  onSelectWeek,
  currency,
  equityLoaded,
  balanceAtPeriodStart,
}: {
  year: number;
  month: number;
  data: Record<string, number>;
  dayStats: Map<string, DayStats>;
  todayKey: string;
  onSelect: (date: string) => void;
  onSelectWeek: (date: string) => void;
  currency: string;
  equityLoaded: boolean;
  balanceAtPeriodStart: (dayKey: string) => number | null;
}) {
  const { theme } = useUnistyles();
  const { formatPnl, formatPnlCompact } = useFormatters();
  const grid = monthGrid(year, month, data);
  const traded = Object.keys(data).filter((k) => k.startsWith(`${year}-${pad(month)}`));
  const green = traded.filter((k) => data[k] > 0).length;
  const red = traded.filter((k) => data[k] < 0).length;

  // Weekend columns only earn their width when the month actually traded on one.
  const dayIdx = monthWeekendColumnsVisible(grid.weeks, dayStats)
    ? [0, 1, 2, 3, 4, 5, 6]
    : [1, 2, 3, 4, 5];
  const maxWeekAbs = Math.max(
    1,
    ...grid.weeks.map((w) => Math.abs(w.reduce((sum, c) => sum + (c?.pnl ?? 0), 0))),
  );

  return (
    <View style={styles.fill}>
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryLabel}>{t`Net P&L`}</Text>
          <Text
            style={[styles.summaryValue, { color: pnlColor(theme.colors, grid.monthTotal) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatPnl(grid.monthTotal, currency)}
          </Text>
        </View>
        <View style={styles.summaryRight}>
          <Text style={styles.summarySub}>
            {traded.length === 1 ? t`1 day` : t`${traded.length} days`}
          </Text>
          <Text style={styles.summarySub}>
            <Text style={{ color: theme.colors.profit, fontWeight: '600' }}>{green}</Text>
            {' / '}
            <Text style={{ color: theme.colors.loss, fontWeight: '600' }}>{red}</Text>
          </Text>
        </View>
      </View>
      <View style={styles.gridHeader}>
        {dayIdx.map((i) => (
          <Text key={i} style={styles.dowLabel} numberOfLines={1}>
            {DOW[i]}
          </Text>
        ))}
        <Text style={styles.dowLabel} numberOfLines={1}>
          {t`Week`}
        </Text>
      </View>
      {grid.weeks.map((week, wi) => {
        const weekPnl = week.reduce((sum, c) => sum + (c?.pnl ?? 0), 0);
        const daysTraded = week.filter((c) => c?.pnl != null).length;
        const weekWins = week.reduce(
          (sum, c) => sum + (c ? (dayStats.get(c.date)?.wins ?? 0) : 0),
          0,
        );
        const weekLosses = week.reduce(
          (sum, c) => sum + (c ? (dayStats.get(c.date)?.losses ?? 0) : 0),
          0,
        );
        const weekAnchor = week.find((c) => c != null)?.date ?? null;
        const weekStartBal = weekAnchor ? balanceAtPeriodStart(weekAnchor) : null;
        const weekReturnPct =
          equityLoaded && weekStartBal != null ? weekPnl / weekStartBal : null;
        const weekLabel =
          daysTraded > 0
            ? t`Week ${wi + 1}, ${formatPnlCompact(weekPnl, currency)}`
            : t`Week ${wi + 1}, No trades`;
        const tileStyle = [
          styles.cell,
          daysTraded > 0
            ? { backgroundColor: pnlBgTint(theme.colors, weekPnl, maxWeekAbs) }
            : styles.emptyCell,
        ];
        const tileBody = (
          <>
            <Text style={[styles.dayNum, daysTraded > 0 && styles.dayNumOnTint]}>W{wi + 1}</Text>
            {daysTraded > 0 ? (
              <View style={styles.cellBody}>
                <Text
                  style={[styles.cellPnl, { color: pnlColor(theme.colors, weekPnl) }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatPnlCompact(weekPnl, currency)}
                </Text>
                {weekReturnPct != null ? (
                  <Text
                    style={[
                      styles.cellSub,
                      { color: pnlColor(theme.colors, weekPnl), fontWeight: '600' },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {`${weekPnl > 0 ? '+' : ''}${formatPercentPoints(weekReturnPct * 100, 1)}`}
                  </Text>
                ) : null}
                <WinLoss wins={weekWins} losses={weekLosses} />
                <Text style={styles.cellSub} numberOfLines={1} adjustsFontSizeToFit>
                  {daysTraded === 1 ? t`1 day` : t`${daysTraded} days`}
                </Text>
              </View>
            ) : (
              <Text style={styles.cellSubIdle}>{t`No trades`}</Text>
            )}
          </>
        );
        return (
          <View key={wi} style={[styles.gridRow, styles.gridRowFlex]}>
            {dayIdx.map((ci) => {
              const cell = week[ci];
              return cell ? (
                <DayCell
                  key={cell.date}
                  date={cell.date}
                  pnl={cell.pnl}
                  stats={dayStats.get(cell.date)}
                  maxAbs={grid.maxAbs}
                  todayKey={todayKey}
                  onSelect={onSelect}
                  currency={currency}
                />
              ) : (
                <View key={`e-${ci}`} style={styles.cell} />
              );
            })}
            {/* Weekly summary tile, same footprint as a day. */}
            {weekAnchor ? (
              <Pressable
                onPress={() => onSelectWeek(weekAnchor)}
                accessibilityRole="button"
                accessibilityLabel={weekLabel}
                style={({ pressed }) => [...tileStyle, pressed && styles.pressed]}
              >
                {tileBody}
              </Pressable>
            ) : (
              <View style={tileStyle}>{tileBody}</View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** One large row per day — the phone-friendly week layout. */
function WeekView({
  anchor,
  data,
  dayStats,
  trades,
  todayKey,
  onSelect,
  currency,
  equityLoaded,
  balanceAtPeriodStart,
}: {
  anchor: string;
  data: Record<string, number>;
  dayStats: Map<string, DayStats>;
  trades: Trade[];
  todayKey: string;
  onSelect: (date: string) => void;
  currency: string;
  equityLoaded: boolean;
  balanceAtPeriodStart: (dayKey: string) => number | null;
}) {
  const { theme } = useUnistyles();
  const { formatPnl } = useFormatters();
  const start = weekStart(anchor);
  const allDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return keyOf(d);
  });
  const days = weekVisibleDayKeys(allDays, data, dayStats);
  const weekPnl = allDays.reduce((sum, key) => sum + (data[key] ?? 0), 0);
  const weekCount = allDays.reduce((sum, key) => sum + (dayStats.get(key)?.count ?? 0), 0);
  const weekWins = allDays.reduce((sum, key) => sum + (dayStats.get(key)?.wins ?? 0), 0);
  const weekLosses = allDays.reduce((sum, key) => sum + (dayStats.get(key)?.losses ?? 0), 0);
  const weekStats = weekTradeStats(trades, allDays);
  // Biggest absolute day drives card tint intensity in the strip.
  const weekMax = Math.max(1, ...days.map((key) => Math.abs(data[key] ?? 0)));
  const weekStartBal = balanceAtPeriodStart(allDays[0]!);
  const weekEndBal = weekStartBal != null ? weekStartBal + weekPnl : null;
  const weekReturnPct =
    equityLoaded && weekStartBal != null ? weekPnl / weekStartBal : null;

  return (
    <View style={styles.fill}>
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryLabel}>{t`Net P&L`}</Text>
          <View style={styles.summaryValueRow}>
            <Text
              style={[styles.summaryValue, { color: pnlColor(theme.colors, weekPnl) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatPnl(weekPnl, currency)}
            </Text>
            {weekReturnPct != null ? (
              <Text
                style={[
                  styles.summaryReturnPct,
                  { color: pnlColor(theme.colors, weekPnl) },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {`${weekPnl > 0 ? '+' : ''}${formatPercentPoints(weekReturnPct * 100, 1)}`}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.summaryRight}>
          <Text style={styles.summarySub}>
            {weekCount === 1 ? t`1 trade` : t`${weekCount} trades`}
          </Text>
          <WinLoss wins={weekWins} losses={weekLosses} style={styles.summarySub} />
        </View>
      </View>
      <WeekStatsBlock
        stats={weekStats}
        currency={currency}
        startBalance={weekStartBal}
        endBalance={weekEndBal}
        showBalance={equityLoaded}
      />
      <WeekPnlStrip
        days={days}
        data={data}
        weekMax={weekMax}
        onSelect={onSelect}
        currency={currency}
      />
      <View style={styles.weekDays}>
      {days.map((key) => {
        const pnl = data[key] ?? null;
        const stats = dayStats.get(key);
        const count = stats?.count ?? 0;
        const wins = stats?.wins ?? 0;
        const losses = stats?.losses ?? 0;
        const decided = wins + losses;
        const isToday = key === todayKey;
        const d = new Date(`${key}T00:00:00Z`);
        return (
          <Pressable
            key={key}
            disabled={pnl == null}
            onPress={() => onSelect(key)}
            style={({ pressed }) => [
              styles.weekRow,
              pnl != null && { backgroundColor: pnlBgTint(theme.colors, pnl, weekMax) },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.weekRowLeft}>
              <Text style={[styles.weekRowDay, isToday && { color: theme.colors.accent }]}>
                {d.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })}
              </Text>
              <Text style={styles.weekRowDate}>
                {d.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })}
              </Text>
            </View>
            <View style={styles.weekRowRight}>
              {count > 0 ? (
                <Text style={styles.weekRowCount}>
                  {count === 1 ? t`1 trade` : t`${count} trades`}
                  {'  '}
                  <WinLoss wins={wins} losses={losses} />
                  {decided > 0 ? ` · ${Math.round((wins / decided) * 100)}%` : ''}
                </Text>
              ) : null}
              {pnl != null ? (
                <Text style={[styles.weekRowPnl, { color: pnlColor(theme.colors, pnl) }]}>
                  {formatPnl(pnl, currency)}
                </Text>
              ) : (
                <Text style={styles.weekRowEmpty}>{t`No trades`}</Text>
              )}
            </View>
          </Pressable>
        );
      })}
      </View>
    </View>
  );
}

/** 12 mini heatmaps, tap-through to the month — the web year view, phone-sized. */
function YearView({
  year,
  data,
  dayStats,
  currency,
  equityLoaded,
  yearStartBalance,
  onSelectMonth,
}: {
  year: number;
  data: Record<string, number>;
  dayStats: Map<string, DayStats>;
  currency: string;
  equityLoaded: boolean;
  yearStartBalance: number | null;
  onSelectMonth: (month: number) => void;
}) {
  const { theme } = useUnistyles();
  const { formatPnl, formatPnlCompact } = useFormatters();
  const yearTotal = Object.entries(data)
    .filter(([k]) => k.startsWith(`${year}-`))
    .reduce((sum, [, v]) => sum + v, 0);
  const yearCount = [...dayStats.entries()]
    .filter(([k]) => k.startsWith(`${year}-`))
    .reduce((sum, [, s]) => sum + s.count, 0);
  const maxAbs = Math.max(
    1,
    ...Object.entries(data)
      .filter(([k]) => k.startsWith(`${year}-`))
      .map(([, v]) => Math.abs(v)),
  );

  return (
    <View style={styles.fill}>
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryLabel}>{t`Net P&L`}</Text>
          <Text
            style={[styles.summaryValue, { color: pnlColor(theme.colors, yearTotal) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatPnl(yearTotal, currency)}
          </Text>
        </View>
        <View style={styles.summaryRight}>
          <Text style={styles.summarySub}>
            {yearCount === 1 ? t`1 trade` : t`${yearCount} trades`}
          </Text>
          {equityLoaded && yearStartBalance != null ? (
            <Text style={[styles.summarySub, { color: pnlColor(theme.colors, yearTotal) }]}>
              {`${yearTotal > 0 ? '+' : ''}${formatPercentPoints((yearTotal / yearStartBalance) * 100, 1)}`}
            </Text>
          ) : null}
        </View>
      </View>
      {/* Explicit 4×3 flex grid: rows, tiles, and dot rows all flex so the
          board divides the safe area exactly — no overflow, no dead space. */}
      <View style={styles.yearGrid}>
        {Array.from({ length: 4 }, (_, r) => (
          <View key={r} style={styles.yearRow}>
            {Array.from({ length: 3 }, (_, c) => {
              const m = r * 3 + c + 1;
              const grid = monthGrid(year, m, data);
              // Pad to 6 week rows so every tile shares one dot geometry.
              const weeks = [...grid.weeks];
              while (weeks.length < 6) weeks.push(Array.from({ length: 7 }, () => null));
              const monthKey = `${year}-${pad(m)}`;
              const count = [...dayStats.entries()]
                .filter(([k]) => k.startsWith(monthKey))
                .reduce((sum, [, s]) => sum + s.count, 0);
              const label = new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString(locale, {
                month: 'short',
                timeZone: 'UTC',
              });
              return (
                <Pressable
                  key={m}
                  onPress={() => onSelectMonth(m)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.yearMonth, pressed && styles.pressed]}
                >
                  <Text style={[styles.yearMonthLabel, count === 0 && styles.yearMonthIdleText]}>
                    {label}
                  </Text>
                  <View style={styles.yearWeeks}>
                    {weeks.map((week, wi) => (
                      <View key={wi} style={styles.yearWeek}>
                        {week.map((cell, ci) => (
                          <View
                            key={cell?.date ?? `e-${ci}`}
                            style={[
                              styles.yearDot,
                              // Out-of-month slots vanish; traded days run vivid.
                              cell == null && styles.yearDotVoid,
                              cell?.pnl != null && {
                                backgroundColor: pnlDotTint(theme.colors, cell.pnl, maxAbs),
                              },
                            ]}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                  {grid.monthTotal !== 0 ? (
                    <Text
                      style={[
                        styles.yearMonthTotal,
                        { color: pnlColor(theme.colors, grid.monthTotal) },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {formatPnlCompact(grid.monthTotal, currency)}
                    </Text>
                  ) : (
                    <Text style={styles.yearMonthEmpty}>{formatPnlCompact(0, currency)}</Text>
                  )}
                  <Text
                    style={[styles.yearMonthCount, count === 0 && styles.yearMonthIdleText]}
                    numberOfLines={1}
                  >
                    {count === 0 ? t`No trades` : count === 1 ? t`1 trade` : t`${count} trades`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  // flexGrow + flexed rows make each mode fill the safe area exactly — no scrolling
  // in normal use; small screens can still overflow into a scroll.
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
  },
  fill: { flex: 1 },
  // The host keeps the viewport-filling layout slot; boards stack inside it
  // absolutely so an exiting one overlaps the entering one during transitions.
  boardHost: { flex: 1 },
  boardLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // Opaque so the pager settling its first layout stays hidden underneath.
  skeletonOverlay: { backgroundColor: theme.colors.background },
  // Nav-bar-title weight, sized down and width-capped: the compact segmented
  // control and pager chevrons leave the title only the bar's middle sliver.
  headerTitle: {
    maxWidth: 118,
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  headerTitleButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  // Sits under the transparent header; light enough that the live board —
  // which pages as the wheels spin — still reads through.
  pickerScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
    opacity: 0.4,
  },
  pickerCard: {
    position: 'absolute',
    top: theme.spacing.xs,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.lg + 4,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.3)',
  },
  // Year mode spins a single wheel — a slim centered card, not a full-width one.
  pickerCardNarrow: { left: undefined, right: undefined, alignSelf: 'center', width: 180 },
  pagerButtons: { flexDirection: 'row', gap: theme.spacing.sm },
  pagerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
  },
  pressed: { opacity: 0.6 },
  skeletonSummary: { gap: 6 },
  skeletonLabel: { width: 56, height: 12 },
  skeletonValue: { width: 150, height: 26 },
  skeletonSide: { width: 84, height: 34 },
  skeletonCell: { flex: 1, borderRadius: theme.radius.lg },
  gridHeader: { flexDirection: 'row', gap: 6, marginBottom: theme.spacing.xs },
  gridRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  // Rows split the viewport height evenly so the month board fills the screen
  // down to the tab bar without scrolling; the floor keeps tiles tappable.
  gridRowFlex: { flex: 1, minHeight: 52 },
  dowLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.mutedForeground,
    paddingVertical: theme.spacing.xs,
  },
  cell: {
    flex: 1,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingVertical: theme.spacing.xs,
  },
  emptyCell: { backgroundColor: theme.colors.muted },
  cellBody: { alignItems: 'center', gap: 3, paddingTop: theme.spacing.sm, maxWidth: '100%' },
  dayNum: {
    position: 'absolute',
    top: 6,
    right: 7,
    fontSize: 11,
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
  // On tinted cells mutedForeground fails contrast — dimmed foreground instead.
  dayNumOnTint: { color: theme.colors.foreground, opacity: 0.72 },
  cellPnl: { fontSize: 13, fontWeight: '700', ...theme.numeric },
  cellSub: { fontSize: 10, color: theme.colors.foreground, opacity: 0.72, ...theme.numeric },
  // Idle (untinted) tiles keep the quiet muted text.
  cellSubIdle: { fontSize: 10, color: theme.colors.mutedForeground, ...theme.numeric },
  wl: { fontSize: 10, fontWeight: '600', ...theme.numeric },
  // Summary header above the grid: big net figure left, period facts right.
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingHorizontal: 2,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
  summaryLabel: { fontSize: 11, color: theme.colors.mutedForeground, marginBottom: 2 },
  summaryValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm },
  summaryValue: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4, ...theme.numeric },
  summaryReturnPct: { fontSize: 15, fontWeight: '600', ...theme.numeric },
  summaryRight: { alignItems: 'flex-end', gap: 3, paddingBottom: 2 },
  summarySub: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  weekStats: { gap: theme.spacing.xs, paddingBottom: theme.spacing.sm },
  weekStatsRow: { flexDirection: 'row', gap: theme.spacing.sm },
  weekStatCell: { flex: 1, alignItems: 'center', gap: 2 },
  weekStatLabel: { fontSize: 10, color: theme.colors.mutedForeground },
  weekStatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.foreground,
    ...theme.numeric,
  },
  weekStatBalance: {
    textAlign: 'center',
    fontSize: 11,
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
  // Rows are content-sized (minHeight floor); leftover height sits below the list.
  weekDays: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  weekRowLeft: { gap: 1 },
  weekRowDay: { fontSize: 14, fontWeight: '600', color: theme.colors.foreground },
  weekRowDate: { fontSize: 11, color: theme.colors.mutedForeground, ...theme.numeric },
  weekRowRight: { alignItems: 'flex-end', gap: 1 },
  weekRowPnl: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, ...theme.numeric },
  weekRowEmpty: { fontSize: 12, fontWeight: '500', color: theme.colors.mutedForeground },
  // Renders only on tinted (traded) cards, where mutedForeground fails
  // contrast — foreground dimmed via opacity keeps the nested W/L hues legible.
  weekRowCount: { fontSize: 10, color: theme.colors.foreground, opacity: 0.72, ...theme.numeric },
  yearGrid: { flex: 1, gap: theme.spacing.sm },
  yearRow: { flex: 1, flexDirection: 'row', gap: theme.spacing.sm },
  yearMonth: {
    flex: 1,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  yearMonthLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  yearMonthIdleText: { color: theme.colors.mutedForeground },
  // Dots flex in both axes (no aspect ratio) so six week rows always divide
  // the tile's remaining height exactly.
  yearWeeks: { flex: 1, gap: 3, marginTop: 6 },
  yearWeek: { flex: 1, flexDirection: 'row', gap: 3 },
  yearDot: {
    flex: 1,
    borderRadius: 4,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
  },
  yearDotVoid: { backgroundColor: 'transparent' },
  yearMonthTotal: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    ...theme.numeric,
  },
  yearMonthEmpty: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
  yearMonthCount: {
    marginTop: 1,
    textAlign: 'center',
    fontSize: 10,
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
}));
