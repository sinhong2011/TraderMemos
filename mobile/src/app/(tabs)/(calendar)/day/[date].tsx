import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { cn, LineChart, Skeleton } from 'panelui-native';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import {
  useAccounts,
  useBehavior,
  useCompliance,
  useNotes,
  useSummary,
  useTrades,
} from '@/api/hooks';
import { Icon } from '@/components/icon';
import type { BehaviorReport, ComplianceReport, Note, Trade } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { InlineError } from '@/components/error-state';
import { Pill } from '@/components/pill';
import { StatBar } from '@/components/stat-bar';
import { SwipeableTradeRow } from '@/components/swipeable-trade-row';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { useSelectedAccountId } from '@/lib/account-store';
import { dayBounds, useGlobalFilters } from '@/lib/filters';
import { formatPercent, useFormatters } from '@/lib/format';
import { noteExcerpt } from '@/lib/markdown';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency } from '@/lib/prefs';
import { pnlClass, pnlColor, usePnlPalette } from '@/styles/pnl';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Noon-anchored so a ±1 day step can't land on a DST-shortened midnight. */
function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayTitle(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Close-ordered running total of realized P&L, in display currency. */
function cumulativePnl(trades: Trade[], fxRate: number) {
  const closed = trades
    .filter((trade) => trade.closed_at != null && trade.net_pnl != null)
    .sort((a, b) => String(a.closed_at).localeCompare(String(b.closed_at)));
  let running = 0;
  return closed.map((trade, index) => {
    running += (trade.net_pnl ?? 0) * fxRate;
    return { x: index + 1, y: running, at: String(trade.closed_at) };
  });
}

/**
 * Cumulative realized P&L over the session, stepped at each close. Plotted
 * against the close index (the equity-card idiom) — clock times ride along in
 * the tooltip and the caption, where they stay readable at phone width.
 *
 * The break-even line is carried as a flat second series: PanelUI's charts have
 * no reference-line part, and a dashed constant is the same picture — it also
 * pins zero inside the y-domain, which a bare annotation would not.
 */
function IntradayCurve({
  trades,
  currency,
  fxRate,
}: {
  trades: Trade[];
  currency: string;
  fxRate: number;
}) {
  const palette = usePnlPalette();
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  const { formatPnl, formatTime } = useFormatters();
  const series = useMemo(() => cumulativePnl(trades, fxRate), [trades, fxRate]);

  if (series.length < 2) {
    return (
      <Text className="text-[13px] leading-[19px] text-muted-foreground">
        {t`Not enough closed trades to draw a session curve.`}
      </Text>
    );
  }

  const final = series[series.length - 1].y;
  const peak = series.reduce((best, point) => (point.y > best.y ? point : best), series[0]);
  // The session's own verdict tints the curve — a green line under a red close
  // is the one reading this card must not allow.
  const curveColor = pnlColor(palette, final);
  const data = series.map((point) => ({ ...point, zero: 0 }));

  return (
    <>
      <View className="flex-row items-baseline gap-2">
        <Text
          selectable
          className={cn('text-[22px] font-semibold tabular-nums', pnlClass(final))}
        >
          {formatPnl(final, currency)}
        </Text>
        <Text className="text-[13px] text-muted-foreground">{t`over ${series.length} closes`}</Text>
      </View>
      <LineChart data={data} xDataKey="x" aspectRatio={1.9}>
        <LineChart.Grid />
        <LineChart.Line dataKey="y" color={curveColor} />
        <LineChart.Line dataKey="zero" color={mutedForeground} strokeWidth={1} dashArray="4,4" />
        <LineChart.Tooltip
          color={curveColor}
          formatValue={(value) => formatPnl(value, currency)}
          formatX={(datum) => formatTime(String(datum.at))}
        />
      </LineChart>
      {peak.y > final ? (
        <Text className="text-xs text-muted-foreground">
          {t`Peaked at`}{' '}
          <Text className={cn('font-medium tabular-nums', pnlClass(peak.y))}>
            {formatPnl(peak.y, currency)}
          </Text>{' '}
          {t`around ${formatTime(peak.at)}`}
        </Text>
      ) : null}
    </>
  );
}

/** Rule-compliance and behavior flags for the day, as web's pill rows. */
function DayFlags({
  date,
  compliance,
  behavior,
}: {
  date: string;
  compliance?: ComplianceReport;
  behavior?: BehaviorReport;
}) {
  const day = compliance?.days.find((entry) => entry.date === date);
  const behaviorFlags =
    (behavior?.revenge.events.length ?? 0) +
    (behavior?.overconfidence.events.length ?? 0) +
    (behavior?.loss_aversion.give_back_count ?? 0);

  return (
    <>
      {compliance?.rules_configured ? (
        <View className="flex-row flex-wrap items-center gap-1">
          {day == null ? (
            <Pill>{t`no closed trades scored`}</Pill>
          ) : day.compliant ? (
            <Pill tone="pos">{t`rules followed`}</Pill>
          ) : (
            <>
              {day.risk_violations > 0 ? (
                <Pill tone="neg">{t`over-risked ×${day.risk_violations}`}</Pill>
              ) : null}
              {day.daily_loss_breach ? <Pill tone="neg">{t`daily loss breached`}</Pill> : null}
            </>
          )}
          {day != null && day.unknown_risk > 0 ? (
            <Pill tone="amber">{t`${day.unknown_risk} without recorded risk`}</Pill>
          ) : null}
        </View>
      ) : null}

      {behavior != null && behaviorFlags > 0 ? (
        <View className="flex-row flex-wrap items-center gap-1">
          {behavior.revenge.events.length > 0 ? (
            <Pill tone="amber">{t`revenge trades ×${behavior.revenge.events.length}`}</Pill>
          ) : null}
          {behavior.overconfidence.events.length > 0 ? (
            <Pill tone="amber">
              {t`oversized after streak ×${behavior.overconfidence.events.length}`}
            </Pill>
          ) : null}
          {behavior.loss_aversion.give_back_count > 0 ? (
            <Pill tone="amber">
              {t`profit given back ×${behavior.loss_aversion.give_back_count}`}
            </Pill>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

/** One journal entry for the day — title over an excerpt, tap to edit. */
function NoteRow({ note, onPress }: { note: Note; onPress: () => void }) {
  const excerpt = noteExcerpt(note.body);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="gap-1 rounded-md bg-muted p-2 active:opacity-60"
    >
      <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
        {note.title || (note.type === 'daily_log' ? t`Daily log` : t`Note`)}
      </Text>
      {excerpt ? (
        <Text className="text-xs leading-[17px] text-muted-foreground" numberOfLines={2}>
          {excerpt}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * One trading day, reviewed the way the web `/day/$date` page does it: what
 * happened, was it inside the rules, and what got written down while it was
 * fresh. Pushed rather than a sheet — four cards need the whole screen — and
 * the header chevrons swap the date in place, so stepping through a week
 * never stacks a screen per day.
 */
export default function CalendarDayScreen() {
  // `expo-symbols` takes a resolved color, not a class.
  const [foreground] = useCSSVariable(['--color-foreground']) as [string];
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const day = date && DATE_RE.test(date) ? date : '';

  const globalFilters = useGlobalFilters();
  const filters = useMemo(
    () => (day ? { ...globalFilters, ...dayBounds(day, globalFilters.tz ?? 'UTC') } : globalFilters),
    [globalFilters, day],
  );

  const trades = useTrades(filters);
  const summary = useSummary(filters);
  const compliance = useCompliance(filters);
  const behavior = useBehavior(filters);
  // `occurred_at` is compared as a raw string server-side, so the window runs
  // to the *next* day key — bounding it at `day` would drop a log saved with a
  // time component ("2026-06-01T14:00Z" sorts after "2026-06-01"). The extra
  // day is filtered back out below.
  const notes = useNotes(day ? { from: day, to: shiftDay(day, 1) } : {});
  const accounts = useAccounts();
  const selectedAccountId = useSelectedAccountId();
  const fx = useMoneyFx(accountBaseCurrency(accounts.data, selectedAccountId));
  const currency = fx.currency;
  const fxRate = fx.rate ?? 1;
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatPnl } = useFormatters();

  const dayTrades = trades.data ?? [];
  const netPnl = (summary.data?.net_pnl ?? 0) * fxRate;
  const fees = (summary.data?.total_fees ?? 0) * fxRate;
  const totalTrades = summary.data?.total_trades ?? 0;
  // Daily logs win when the day has any; plain notes only show when they're
  // all there is (web's dayNotes fallback).
  const dayNotes = useMemo(() => {
    const all = (notes.data ?? []).filter((note) => note.occurred_at.slice(0, 10) === day);
    const logs = all.filter((note) => note.type === 'daily_log');
    return logs.length > 0 ? logs : all;
  }, [notes.data, day]);

  /** Swap the date in place rather than pushing a screen per day. */
  const stepDay = (days: number) => router.setParams({ date: shiftDay(day, days) });

  return (
    <>
      <Stack.Screen
        options={{
          title: day ? dayTitle(day) : t`Day`,
          headerRight: () => (
            <View className="flex-row items-center gap-1">
              <Pressable
                onPress={() => stepDay(-1)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t`Previous day`}
                className="p-1 active:opacity-60"
              >
                <Icon name="chevron.left" size={15} tintColor={foreground} />
              </Pressable>
              <Pressable
                onPress={() => stepDay(1)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t`Next day`}
                className="p-1 active:opacity-60"
              >
                <Icon name="chevron.right" size={15} tintColor={foreground} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="gap-3 p-4 pb-12"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={trades.isRefetching || summary.isRefetching}
            onRefresh={() =>
              void Promise.all([
                trades.refetch(),
                summary.refetch(),
                compliance.refetch(),
                behavior.refetch(),
                notes.refetch(),
              ])
            }
          />
        }
      >
        <DashboardCard title={t`Session summary`} flush>
          {summary.isLoading ? (
            <Skeleton className="h-[200px] rounded-lg" label={t`Loading session summary`} />
          ) : summary.isError && summary.data == null ? (
            // Every StatBar below falls back to a zero, so without this the
            // card reports a flat, feeless, tradeless session as fact.
            //
            // The summary card is `flush`, so its error row brings its own inset.
            <View className="px-4 py-3">
              <InlineError error={summary.error} onRetry={() => void summary.refetch()} />
            </View>
          ) : (
            <>
              <View className="flex-row flex-wrap gap-2">
                <StatBar
                  label={t`Net P&L`}
                  value={formatPnl(netPnl, currency)}
                  tone={netPnl >= 0 ? 'pos' : 'neg'}
                />
                <StatBar label={t`Trades`} value={String(totalTrades)} />
                <StatBar
                  label={t`Win rate`}
                  value={totalTrades > 0 ? formatPercent(summary.data?.win_rate, 0) : t`No trades`}
                  sub={
                    totalTrades > 0
                      ? t`${summary.data?.wins ?? 0}W · ${summary.data?.losses ?? 0}L`
                      : undefined
                  }
                />
                <StatBar
                  label={t`Fees`}
                  value={formatPnl(-fees, currency)}
                  tone={fees > 0 ? 'neg' : 'muted'}
                />
              </View>
              <DayFlags date={day} compliance={compliance.data} behavior={behavior.data} />
            </>
          )}
        </DashboardCard>

        <DashboardCard title={t`Intraday P&L`}>
          {trades.isLoading ? (
            <Skeleton className="h-[190px] rounded-lg" />
          ) : trades.isError && trades.data == null ? (
            <InlineError error={trades.error} onRetry={() => void trades.refetch()} />
          ) : (
            <IntradayCurve trades={dayTrades} currency={currency} fxRate={fxRate} />
          )}
        </DashboardCard>

        <DashboardCard title={t`Trades`}>
          {trades.isLoading ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : trades.isError && trades.data == null ? (
            <InlineError error={trades.error} onRetry={() => void trades.refetch()} />
          ) : dayTrades.length === 0 ? (
            <Text className="text-[13px] leading-[19px] text-muted-foreground">{t`No trades on this day.`}</Text>
          ) : (
            <View className="gap-2">
              {dayTrades.map((trade) => (
                <SwipeableTradeRow key={trade.id} trade={trade} showDate={false} />
              ))}
            </View>
          )}
        </DashboardCard>

        <DashboardCard
          title={t`Daily log`}
          action={{
            label: t`New`,
            onPress: () =>
              router.push({ pathname: '/new-note', params: { date: day, type: 'daily_log' } }),
          }}
        >
          {notes.isLoading ? (
            <Skeleton className="h-[72px] rounded-lg" />
          ) : notes.isError && notes.data == null ? (
            <InlineError error={notes.error} onRetry={() => void notes.refetch()} />
          ) : dayNotes.length === 0 ? (
            <Text className="text-[13px] leading-[19px] text-muted-foreground">
              {t`Nothing journaled for this day yet. A two-minute recap while it's fresh beats a perfect writeup never written.`}
            </Text>
          ) : (
            <View className="gap-2">
              {dayNotes.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  onPress={() => router.push({ pathname: '/edit-note', params: { id: note.id } })}
                />
              ))}
            </View>
          )}
        </DashboardCard>
      </ScrollView>
    </>
  );
}
