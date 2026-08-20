// See the note in trade-form.tsx / reports.tsx: @expo/ui's SwiftUI pager
// swallows taps on RN views inside its pages, so year paging rides
// react-native-pager-view.
import PagerView from 'react-native-pager-view';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { Card, Skeleton, cn } from 'panelui-native';
import { useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { useAccounts, useTrades } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { ErrorState } from '@/components/error-state';
import { HeaderIconButton } from '@/components/header-icon-button';
import { StatBar } from '@/components/stat-bar';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { useSelectedAccountId } from '@/lib/account-store';
import { formatDuration, formatPercent, formatRatio, useFormatters } from '@/lib/format';
import { useMoneyFx } from '@/lib/money';
import { usePagerBottomInset } from '@/lib/pager-insets';
import { useSoftTopEdge } from '@/lib/soft-scroll-edge';
import { accountBaseCurrency } from '@/lib/prefs';
import { computeYearWrapped } from '@/lib/wrapped';
import { pnlClass, pnlColor, usePnlPalette } from '@/styles/pnl';

const MIN_YEAR = 2000;

/** Card-shaped stand-ins while a year's trades are still out. */
const SKELETON_TALL = 'h-[180px] rounded-[18px]';
const SKELETON_CARD = 'h-[200px] rounded-[18px]';

function yearsRange(currentYear: number): number[] {
  const years: number[] = [];
  for (let y = MIN_YEAR; y <= currentYear; y++) years.push(y);
  return years;
}

function monthShort(month: number): string {
  return new Date(Date.UTC(2024, month, 1)).toLocaleDateString(locale, {
    month: 'short',
    timeZone: 'UTC',
  });
}

/** One spring for the strip: the capsule settles rather than snapping. */
const DOT_MOTION = LinearTransition.springify()
  .damping(20)
  .stiffness(220)
  .reduceMotion(ReduceMotion.System);

/**
 * Page dots, pinned under the bar rather than riding the scroll content: it is
 * the screen's switcher, so it has to stay put like a tab strip while a year
 * scrolls beneath it. The year itself is the recap card's own heading.
 */
function YearIndicator({
  years,
  index,
  currentYear,
  onSelect,
}: {
  years: number[];
  index: number;
  currentYear: number;
  onSelect: (index: number) => void;
}) {
  // Sliding window of at most 7 dots so a 2000→now range doesn't paint a grid.
  const windowSize = Math.min(7, years.length);
  const windowStart = Math.max(
    0,
    Math.min(index - Math.floor(windowSize / 2), years.length - windowSize),
  );
  if (years.length < 2) return null;

  return (
    <View className="flex-row items-center justify-center gap-1.5 bg-background px-4 py-3">
      {Array.from({ length: windowSize }, (_, i) => {
        const pageIndex = windowStart + i;
        const active = pageIndex === index;
        const isCurrentYear = years[pageIndex] === currentYear;
        return (
          // The capsule stretches and the window's dots slide in and out
          // rather than cutting: paging is a continuous gesture, so its
          // indicator has to move continuously too.
          <Animated.View
            key={years[pageIndex]}
            layout={DOT_MOTION}
            entering={FadeIn.duration(140).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(110).reduceMotion(ReduceMotion.System)}
          >
            <Pressable
              onPress={() => onSelect(pageIndex)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={String(years[pageIndex])}
              accessibilityState={{ selected: active }}
              // Capsule chip dots — trade-form pager language, without a
              // bordered track. Width says "you are here"; the year still
              // running is a bigger, tinted dot, so both read when they
              // coincide.
              className={cn(
                'h-1.5 w-1.5 rounded-full bg-muted',
                active && 'w-3.5 bg-foreground',
                isCurrentYear && 'h-2 bg-primary',
                isCurrentYear && (active ? 'w-4' : 'w-2'),
              )}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

/** One year's recap — own query + scroll so the pager can keep pages independent. */
function WrappedYear({
  year,
  active,
  topInset,
}: {
  year: number;
  active: boolean;
  /** Header + pinned dot strip: what this page's content has to clear. */
  topInset: number;
}) {
  // The month bars are drawn views, so their fills are token values.
  const palette = usePnlPalette();
  const selectedAccountId = useSelectedAccountId();
  // Far pages stay mounted for swipe physics but skip the network until nearby.
  const trades = useTrades(
    {
      ...(selectedAccountId ? { account_id: selectedAccountId } : {}),
      from: `${year}-01-01T00:00:00Z`,
      to: `${year + 1}-01-01T00:00:00Z`,
    },
    { enabled: active },
  );
  const accounts = useAccounts();
  const fx = useMoneyFx(accountBaseCurrency(accounts.data, selectedAccountId));
  const currency = fx.currency;
  const rate = fx.rate ?? 1;
  const { formatPnl, formatPnlCompact } = useFormatters();
  // Nested in the pager, `automatic` never gets the tab-bar bottom inset
  // (see lib/pager-insets.ts) — the last card needs explicit clearance.
  const bottomInset = usePagerBottomInset();
  const softTopEdge = useSoftTopEdge();

  const wrapped = useMemo(() => computeYearWrapped(trades.data ?? [], year), [trades.data, year]);
  const money = (v: number) => formatPnl(v * rate, currency);
  const moneyCompact = (v: number) => formatPnlCompact(v * rate, currency);
  const maxMonthTrades = Math.max(...wrapped.months.map((m) => m.trades), 1);

  return (
    <ScrollView
      className="bg-background"
      // Nominated so UIKit drives the (transparent, blurred) bar from the page
      // being read: neither its nor screens' own discovery reaches a scroll
      // view nested in a pager. See lib/soft-scroll-edge.
      ref={softTopEdge}
      // Both insets manual for the same reason — `automatic` never reaches in
      // here (lib/pager-insets.ts), so it would leave the content under the bar.
      contentInsetAdjustmentBehavior="never"
      contentContainerClassName="gap-4 p-4"
      contentContainerStyle={{ paddingTop: topInset, paddingBottom: 48 + bottomInset }}
      refreshControl={
        <RefreshControl
          refreshing={trades.isRefetching}
          onRefresh={() => void trades.refetch()}
        />
      }
    >
      {trades.isLoading || (!active && trades.data == null) ? (
        <>
          <Skeleton className={SKELETON_TALL} label={t`Loading ${year}`} />
          <Skeleton className={SKELETON_CARD} />
        </>
      ) : trades.error && trades.data == null ? (
        // The recap is computed from the trades, so a failed fetch with no
        // cache produces a zeroed wrapped — indistinguishable from a year you
        // didn't trade. Cached trades still recap fine.
        <View className="min-h-[320px]">
          <ErrorState
            error={trades.error}
            onRetry={() => void trades.refetch()}
            retrying={trades.isRefetching}
          />
        </View>
      ) : wrapped.totalTrades === 0 ? (
        <View className="min-h-[320px]">
          <EmptyState
            title={t`No closed trades in ${year}`}
            systemImage="sparkles"
            description={t`The recap appears once the year has closed trades.`}
          />
        </View>
      ) : (
        <>
          {/* The hero card wears the year as its own title — centred and at
              heading scale rather than in the small grey caps every other card
              uses, because on this screen the year *is* the subject. */}
          <Card className="items-center gap-1 rounded-lg border-0 p-4 pt-3">
            <Text
              className="text-[22px] font-semibold tracking-tight tabular-nums text-foreground"
              accessibilityRole="header"
            >
              {year}
            </Text>
            <View className="items-center gap-1 pb-1">
              <Text
                selectable
                className={cn(
                  'text-[34px] font-semibold tracking-tight tabular-nums',
                  pnlClass(wrapped.netPnl),
                )}
              >
                {money(wrapped.netPnl)}
              </Text>
              <Text className="text-xs text-muted-foreground tabular-nums">
                {t`${wrapped.totalTrades} closed trades · ${formatPercent(wrapped.winRate, 0)} win rate · ${wrapped.tradingDays} trading days`}
              </Text>
            </View>
          </Card>

          <DashboardCard title={t`Your highs`} flush>
            <View className="flex-row flex-wrap gap-2">
              <StatBar
                label={t`Best day`}
                value={wrapped.bestDay ? moneyCompact(wrapped.bestDay.pnl) : moneyCompact(0)}
                sub={wrapped.bestDay?.date}
                tone="pos"
              />
              <StatBar
                label={t`Biggest win`}
                value={wrapped.biggestWin ? moneyCompact(wrapped.biggestWin.pnl) : moneyCompact(0)}
                sub={wrapped.biggestWin?.symbol}
                tone="pos"
              />
              <StatBar
                label={t`Longest win streak`}
                value={String(wrapped.bestStreak)}
                sub={t`wins in a row`}
                tone="pos"
              />
              <StatBar
                label={t`Green days`}
                value={String(wrapped.greenDays)}
                sub={t`of ${wrapped.tradingDays}`}
                tone="pos"
              />
            </View>
          </DashboardCard>

          <DashboardCard title={t`Your lows`} flush>
            <View className="flex-row flex-wrap gap-2">
              <StatBar
                label={t`Worst day`}
                value={wrapped.worstDay ? moneyCompact(wrapped.worstDay.pnl) : moneyCompact(0)}
                sub={wrapped.worstDay?.date}
                tone="neg"
              />
              <StatBar
                label={t`Biggest loss`}
                value={
                  wrapped.biggestLoss ? moneyCompact(wrapped.biggestLoss.pnl) : moneyCompact(0)
                }
                sub={wrapped.biggestLoss?.symbol}
                tone="neg"
              />
              <StatBar
                label={t`Longest loss streak`}
                value={String(wrapped.worstStreak)}
                sub={t`losses in a row`}
                tone="neg"
              />
              <StatBar
                label={t`Red days`}
                value={String(wrapped.redDays)}
                sub={t`of ${wrapped.tradingDays}`}
                tone="neg"
              />
              <StatBar
                label={t`Most-tagged mistake`}
                value={wrapped.mainMistake ?? t`None tagged`}
                tone={wrapped.mainMistake ? 'neg' : 'muted'}
              />
            </View>
          </DashboardCard>

          <DashboardCard title={t`Your rhythm`}>
            <View className="h-24 flex-row items-end gap-1">
              {wrapped.months.map((month) => (
                <View key={month.month} className="h-full flex-1 items-center gap-[3px]">
                  <View className="w-full flex-1 justify-end">
                    <View
                      className={cn(
                        'w-full rounded-[3px]',
                        month.trades === 0 && 'bg-muted',
                      )}
                      style={{
                        height: `${Math.max(4, (month.trades / maxMonthTrades) * 100)}%`,
                        ...(month.trades === 0
                          ? null
                          : { backgroundColor: pnlColor(palette, month.pnl) }),
                      }}
                    />
                  </View>
                  <Text className="text-[8px] text-muted-foreground">
                    {monthShort(month.month)}
                  </Text>
                </View>
              ))}
            </View>
            {wrapped.busiestMonth ? (
              <Text className="text-xs text-muted-foreground">
                {t`Busiest month: ${monthShort(wrapped.busiestMonth.month)} with ${wrapped.busiestMonth.trades} trades.`}
              </Text>
            ) : null}
          </DashboardCard>

          <DashboardCard title={t`Your habits`} flush>
            <View className="flex-row flex-wrap gap-2">
              {wrapped.topSymbols.map((symbol, index) => (
                <StatBar
                  key={symbol.symbol}
                  label={index === 0 ? t`Most traded` : t`#${index + 1}`}
                  value={symbol.symbol}
                  sub={`${symbol.trades} · ${moneyCompact(symbol.pnl)}`}
                  tone={index === 0 ? 'accent' : 'muted'}
                />
              ))}
              <StatBar
                label={t`Time in the market`}
                value={formatDuration(wrapped.totalHoldSecs)}
              />
              <StatBar label={t`Average hold`} value={formatDuration(wrapped.avgHoldSecs)} />
            </View>
          </DashboardCard>

          <DashboardCard title={t`Bottom line`} flush>
            <View className="flex-row flex-wrap gap-2">
              <StatBar
                label={t`Profit factor`}
                value={formatRatio(wrapped.profitFactor)}
                tone={wrapped.profitFactor >= 1 ? 'pos' : 'neg'}
              />
              <StatBar
                label={t`Expectancy`}
                value={moneyCompact(wrapped.expectancy)}
                sub={t`per trade`}
                tone={wrapped.expectancy >= 0 ? 'pos' : 'neg'}
              />
              <StatBar
                label={t`Fees paid`}
                value={moneyCompact(-wrapped.totalFees)}
                tone="neg"
              />
            </View>
          </DashboardCard>
        </>
      )}
    </ScrollView>
  );
}

/** Annual recap — swipeable years, one page each from MIN_YEAR to now. */
export default function WrappedScreen() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => yearsRange(currentYear), [currentYear]);
  const initialIndex = years.length - 1;
  const [index, setIndex] = useState(initialIndex);
  const pagerRef = useRef<PagerView>(null);
  // Measured here, once, and handed to every page. UIKit's automatic inset
  // adjustment does not reach a scroll view nested in a pager (the same gap
  // `usePagerBottomInset` covers at the bottom), so the pages pad by hand —
  // but a page measuring on its own clock reads whatever bar happened to be
  // on top when the pager got round to mounting it, and a year mounted while
  // a large-title screen was still up padded itself 68pt too far.
  const [headerHeight] = useState(useHeaderHeight());
  // Measured rather than assumed: the strip's height is the rest of the pages'
  // top inset, and it moves with the text size.
  const [stripHeight, setStripHeight] = useState(0);

  const selectIndex = (next: number) => {
    const clamped = Math.max(0, Math.min(years.length - 1, next));
    setIndex(clamped);
    pagerRef.current?.setPage(clamped);
  };

  const shareYear = years[index]!;
  return (
    <>
      <Stack.Screen
        options={{
          title: t`Year Wrapped`,
          headerLargeTitle: false,
          // Share-card export for the visible year (#198).
          headerRight: () => (
            <HeaderIconButton
              systemImage="square.and.arrow.up"
              label={t`Share`}
              onPress={() =>
                router.push({
                  pathname: '/share-wrapped',
                  params: { year: String(shareYear) },
                })
              }
            />
          ),
        }}
      />
      <View className="flex-1 bg-background">
        <PagerView
          ref={pagerRef}
          initialPage={initialIndex}
          style={FILL}
          onPageSelected={(event) => setIndex(event.nativeEvent.position)}
        >
          {years.map((year, pageIndex) => (
            <View key={year} className="flex-1" collapsable={false}>
              <WrappedYear
                year={year}
                active={Math.abs(pageIndex - index) <= 1}
                topInset={headerHeight + stripHeight}
              />
            </View>
          ))}
        </PagerView>
        {/* Pinned over the pages, below the bar: one switcher for every page,
            and it stays put while a year scrolls under it. Opaque, so the rows
            passing beneath disappear rather than showing through. */}
        <View
          className="absolute inset-x-0 z-10"
          style={{ top: headerHeight }}
          onLayout={(e) => setStripHeight(e.nativeEvent.layout.height)}
        >
          <YearIndicator
            years={years}
            index={index}
            currentYear={currentYear}
            onSelect={selectIndex}
          />
        </View>
      </View>
    </>
  );
}

/** `PagerView` is a native component, not one Uniwind styles by class. */
const FILL = { flex: 1 } as const;
