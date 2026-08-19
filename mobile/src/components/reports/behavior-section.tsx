import { useRouter } from 'expo-router';
import { RadarChart, Skeleton } from 'panelui-native';
import { Text, View } from 'react-native';

import { useBehavior, useSummary } from '@/api/hooks';
import type { BehaviorEvent, BehaviorReport, OutcomeSplit } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { ErrorState } from '@/components/error-state';
import { StatBar } from '@/components/stat-bar';
import { EventRow, MicroHeading } from '@/components/reports/shared';
import {
  SectionScaffold,
  useReportsFilters,
  useReportsMoney,
  type ReportsMoneyContext,
} from '@/components/reports/section-scaffold';
import { t } from '@lingui/core/macro';
import { formatDuration, formatPercent } from '@/lib/format';
import { pnlColor, usePnlPalette } from '@/styles/pnl';

/** A profit factor of 3 scores the Edge axis full — beyond that it's proven. */
const PF_CAP = 3;
/** A 3× win/loss payoff fills its axis. */
const PAYOFF_CAP = 3;
/** Van Tharp's scale tops out around 7 ("holy grail"). */
const SQN_CAP = 7;

/**
 * The section's verdict as one shape: five-or-six 0–100 scores on a radar,
 * where a rounder polygon is a healthier trader. Axes with nothing behind
 * them are dropped rather than drawn at zero — an empty reading is not a bad
 * one — and under three axes there is no shape to read, so the card skips.
 */
function TraderProfileCard({ report }: { report: BehaviorReport }) {
  const filters = useReportsFilters();
  const summary = useSummary(filters).data;
  if (!summary || summary.total_trades < 2) return null;

  const score = (fraction: number) => Math.max(0, Math.min(100, fraction * 100));
  const axes: { axis: string; score: number }[] = [
    { axis: t`Win rate`, score: score(summary.win_rate) },
    { axis: t`Edge`, score: score(Math.min(summary.profit_factor, PF_CAP) / PF_CAP) },
  ];
  if (summary.avg_loss > 0 || summary.avg_win > 0) {
    const payoff = summary.avg_loss > 0 ? summary.avg_win / summary.avg_loss : PAYOFF_CAP;
    axes.push({ axis: t`Payoff`, score: score(Math.min(payoff, PAYOFF_CAP) / PAYOFF_CAP) });
  }
  // Same guard the Overview dial uses: SQN is undefined on tiny samples.
  if (summary.sqn !== 0) {
    axes.push({ axis: t`Consistency`, score: score(summary.sqn / SQN_CAP) });
  }
  const revenge = report.revenge;
  const scanned = revenge.flagged.trades + revenge.baseline.trades;
  if (!revenge.insufficient_data && scanned > 0) {
    // Full marks with no flagged trades, zero once a quarter of them are.
    const share = revenge.flagged.trades / scanned;
    axes.push({ axis: t`Discipline`, score: score(1 - Math.min(share / 0.25, 1)) });
  }
  const holdRatio = report.loss_aversion.hold_ratio;
  if (holdRatio > 0) {
    // 1× (losers held no longer than winners) is full; 3× and past is zero.
    axes.push({ axis: t`Patience`, score: score((3 - holdRatio) / 2) });
  }
  if (axes.length < 3) return null;

  return (
    <DashboardCard title={t`Trader profile`}>
      <RadarChart data={axes} axisKey="axis" domain={[0, 100]} aspectRatio={1.3}>
        <RadarChart.Grid />
        <RadarChart.Axis />
        <RadarChart.Series dataKey="score" showDots />
      </RadarChart>
      <Text className="text-xs text-muted-foreground">
        {t`Axes score 0–100: profit factor caps at 3, payoff at 3×, SQN at 7; discipline falls with revenge flags, patience with holding losers past winners.`}
      </Text>
    </DashboardCard>
  );
}

/** Flagged-vs-baseline stat tiles shared by the revenge and streak cards. */
function SplitStats({
  flagged,
  baseline,
  events,
  ctx,
}: {
  flagged: OutcomeSplit;
  baseline: OutcomeSplit;
  events: number;
  ctx: ReportsMoneyContext;
}) {
  const { money } = ctx;
  return (
    <View className="flex-row flex-wrap gap-2">
      {/* The event count earns its spot only when it differs from the trade
          count — "54 · 54 events" reads as a stutter, not a second fact. */}
      <StatBar
        plain
        label={t`Flagged trades`}
        value={String(flagged.trades)}
        sub={events === flagged.trades ? undefined : t`${events} events`}
      />
      <StatBar
        plain
        label={t`Flagged P&L`}
        value={money.formatCompact(flagged.net_pnl)}
        tone={flagged.net_pnl >= 0 ? 'pos' : 'neg'}
      />
      <StatBar
        plain
        label={t`Flagged win rate`}
        value={formatPercent(flagged.win_rate, 0)}
        sub={t`baseline ${formatPercent(baseline.win_rate, 0)}`}
        tone={flagged.win_rate < baseline.win_rate ? 'neg' : 'muted'}
      />
      <StatBar
        plain
        label={t`Baseline P&L`}
        value={money.formatCompact(baseline.net_pnl)}
        sub={t`${baseline.trades} trades`}
        tone={baseline.net_pnl >= 0 ? 'pos' : 'neg'}
      />
    </View>
  );
}

function EventList({
  events,
  ctx,
  onOpen,
}: {
  events: BehaviorEvent[];
  ctx: ReportsMoneyContext;
  onOpen: (id: string) => void;
}) {
  const palette = usePnlPalette();
  const recent = events.slice(-6).reverse();
  if (recent.length === 0) return null;
  return (
    <View className="gap-1">
      <MicroHeading>{t`Recent events`}</MicroHeading>
      {recent.map((event) => (
        <EventRow
          key={event.trade_id}
          date={event.date}
          title={event.symbol}
          pill={
            event.reason === 'quick_reentry'
              ? t`re-entry`
              : t`size ×${(event.size_ratio ?? 0).toFixed(1)}`
          }
          value={ctx.money.formatCompact(event.net_pnl)}
          valueTint={pnlColor(palette, event.net_pnl)}
          onPress={() => onOpen(event.trade_id)}
        />
      ))}
    </View>
  );
}

export function BehaviorSection({
  onScrolledChange,
}: {
  onScrolledChange?: (scrolled: boolean) => void;
}) {
  const palette = usePnlPalette();
  const router = useRouter();
  const filters = useReportsFilters();
  const ctx = useReportsMoney();
  const { money } = ctx;
  const behavior = useBehavior(filters);

  const openTrade = (id: string) => router.push(`/(tabs)/(trades)/${id}`);

  const report = behavior.data;
  const revenge = report?.revenge;
  const streaks = report?.overconfidence;
  const lossAversion = report?.loss_aversion;
  const hasHolds =
    lossAversion != null &&
    (lossAversion.avg_win_hold_secs > 0 || lossAversion.avg_loss_hold_secs > 0);

  return (
    <SectionScaffold refreshing={behavior.isRefetching} onScrolledChange={onScrolledChange}>
      {behavior.isLoading ? (
        <>
          <Skeleton className="h-[220px] rounded-[18px]" label={t`Loading behavior report`} />
          <Skeleton className="h-[220px] rounded-[18px]" />
          <Skeleton className="h-[220px] rounded-[18px]" />
        </>
      ) : behavior.error && behavior.data == null ? (
        // Boxed rather than flexed: the scaffold's scroll content has no height
        // of its own, so a `flex: 1` failure state would collapse to nothing.
        <View className="min-h-[320px]">
          <ErrorState
            error={behavior.error}
            onRetry={() => void behavior.refetch()}
            retrying={behavior.isRefetching}
          />
        </View>
      ) : (
        <>
          {report ? <TraderProfileCard report={report} /> : null}

          <DashboardCard title={t`Revenge trading`}>
            {!revenge || revenge.events.length === 0 ? (
              <Text className="py-2 text-[13px] text-muted-foreground">
                {t`No revenge patterns detected — flags trades opened within an hour of a losing close: same-symbol re-entries inside 15 minutes, or entries sized 1.5× above your recent median.`}
              </Text>
            ) : (
              <>
                <SplitStats
                  flagged={revenge.flagged}
                  baseline={revenge.baseline}
                  events={revenge.events.length}
                  ctx={ctx}
                />
                {revenge.insufficient_data ? (
                  <Text className="text-xs text-muted-foreground">
                    {t`Small sample — patterns firm up as more closed trades accumulate.`}
                  </Text>
                ) : null}
                <EventList events={revenge.events} ctx={ctx} onOpen={openTrade} />
              </>
            )}
          </DashboardCard>

          <DashboardCard title={t`Overconfidence`}>
            {!streaks || streaks.events.length === 0 ? (
              <Text className="py-2 text-[13px] text-muted-foreground">
                {t`No streak patterns detected — flags trades sized up right after a winning streak.`}
              </Text>
            ) : (
              <>
                <SplitStats
                  flagged={streaks.flagged}
                  baseline={streaks.baseline}
                  events={streaks.events.length}
                  ctx={ctx}
                />
                <Text className="text-xs text-muted-foreground">
                  {t`${streaks.streaks} winning streaks scanned.`}
                </Text>
                {streaks.insufficient_data ? (
                  <Text className="text-xs text-muted-foreground">
                    {t`Small sample — patterns firm up as more closed trades accumulate.`}
                  </Text>
                ) : null}
                <EventList events={streaks.events} ctx={ctx} onOpen={openTrade} />
              </>
            )}
          </DashboardCard>

          <DashboardCard title={t`Loss aversion`}>
            {!lossAversion || (!hasHolds && lossAversion.give_back_count === 0) ? (
              <Text className="py-2 text-[13px] text-muted-foreground">
                {t`Not enough closed trades yet — compares how long winners and losers are held, and finds losers that were green at their peak.`}
              </Text>
            ) : (
              <>
                <View className="flex-row flex-wrap gap-2">
                  <StatBar
                    plain
                    label={t`Avg winner hold`}
                    value={formatDuration(lossAversion.avg_win_hold_secs)}
                    sub={t`median ${formatDuration(lossAversion.median_win_hold_secs)}`}
                    tone="pos"
                  />
                  <StatBar
                    plain
                    label={t`Avg loser hold`}
                    value={formatDuration(lossAversion.avg_loss_hold_secs)}
                    sub={t`median ${formatDuration(lossAversion.median_loss_hold_secs)}`}
                    tone={lossAversion.hold_ratio > 1.5 ? 'neg' : 'muted'}
                  />
                  <StatBar
                    plain
                    label={t`Hold ratio`}
                    value={
                      lossAversion.hold_ratio > 0 ? `${lossAversion.hold_ratio.toFixed(1)}×` : '0×'
                    }
                    sub={t`losers vs winners`}
                    tone={lossAversion.hold_ratio > 1.5 ? 'neg' : 'muted'}
                  />
                  <StatBar
                    plain
                    label={t`Profit given back`}
                    value={money.formatCompact(lossAversion.missed_profit)}
                    sub={t`${lossAversion.give_back_count} green at peak`}
                    tone={lossAversion.missed_profit > 0 ? 'neg' : 'muted'}
                  />
                </View>

                {lossAversion.excluded > 0 ? (
                  <Text className="text-xs text-muted-foreground">
                    {t`${lossAversion.excluded} losers without recorded MAE/MFE could not be checked — recompute excursion on the trade to fill them.`}
                  </Text>
                ) : null}

                {lossAversion.give_backs.length > 0 ? (
                  <View className="gap-1">
                    <MicroHeading>{t`Biggest give-backs`}</MicroHeading>
                    {lossAversion.give_backs.map((giveBack) => (
                      <EventRow
                        key={giveBack.trade_id}
                        date={giveBack.date}
                        title={giveBack.symbol}
                        pill={t`peak ${money.formatCompact(giveBack.mfe)}`}
                        value={money.formatCompact(giveBack.net_pnl)}
                        valueTint={pnlColor(palette, giveBack.net_pnl)}
                        onPress={() => openTrade(giveBack.trade_id)}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            )}
          </DashboardCard>
        </>
      )}
    </SectionScaffold>
  );
}
