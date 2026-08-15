import { View } from 'react-native';

import type { Summary, Trade } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { StatBar } from '@/components/stat-bar';
import { t } from '@lingui/core/macro';
import { computeDashboardInsights } from '@/lib/insights';
import { formatDuration, useFormatters } from '@/lib/format';

/**
 * The web dashboard's insight bento, folded into a phone-width tile grid:
 * edge quality, streak stability, holds, and leaks.
 */
export function InsightsCard({
  summary,
  trades,
  currency,
  maxDrawdown,
  fxRate = 1,
}: {
  summary: Summary;
  trades: Trade[];
  currency: string;
  maxDrawdown?: number;
  /** Base→display conversion applied before formatting (1 = account currency). */
  fxRate?: number;
}) {
  // Re-render when privacy mode flips — formatters read it at call time.
  const { formatDayKey, formatPnl } = useFormatters();
  const insights = computeDashboardInsights(trades);
  const fx = (v: number) => v * fxRate;
  const drawdown = maxDrawdown ?? 0;
  /** A hold only exists once a trade closes with a timestamped fill. */
  const hold = (secs: number | null) => (secs == null ? t`Not timed` : formatDuration(secs));

  // Tiles run as best/worst contrast pairs (one pair per row at phone width),
  // then the two lone aggregates, then the qualitative read.
  return (
    <DashboardCard title={t`Insights`} flush>
      <View className="flex-row flex-wrap gap-2">
        <StatBar
          label={t`Best trade`}
          value={formatPnl(fx(summary.largest_win), currency)}
          tone={summary.largest_win > 0 ? 'pos' : 'muted'}
        />
        <StatBar
          label={t`Worst trade`}
          value={formatPnl(fx(-summary.largest_loss), currency)}
          tone={summary.largest_loss > 0 ? 'neg' : 'muted'}
        />
        <StatBar
          label={t`Best day`}
          value={formatPnl(fx(insights.bestDay?.pnl ?? 0), currency)}
          sub={insights.bestDay ? formatDayKey(insights.bestDay.date) : undefined}
          tone={insights.bestDay && insights.bestDay.pnl > 0 ? 'pos' : 'muted'}
        />
        <StatBar
          label={t`Worst day`}
          value={formatPnl(fx(insights.worstDay?.pnl ?? 0), currency)}
          sub={insights.worstDay ? formatDayKey(insights.worstDay.date) : undefined}
          tone={insights.worstDay && insights.worstDay.pnl < 0 ? 'neg' : 'muted'}
        />
        <StatBar
          label={t`Best streak`}
          value={String(insights.bestStreak)}
          sub={t`wins`}
          tone={insights.bestStreak > 0 ? 'pos' : 'muted'}
        />
        <StatBar
          label={t`Worst streak`}
          value={String(insights.worstStreak)}
          sub={t`losses`}
          tone={insights.worstStreak > 0 ? 'neg' : 'muted'}
        />
        <StatBar
          label={t`Winning hold`}
          value={hold(insights.winHoldSecs)}
          tone={insights.winHoldSecs == null ? 'muted' : 'pos'}
        />
        <StatBar
          label={t`Losing hold`}
          value={hold(insights.lossHoldSecs)}
          tone={insights.lossHoldSecs == null ? 'muted' : 'neg'}
        />
        <StatBar
          label={t`Avg hold`}
          value={hold(insights.avgHoldSecs)}
          // Counts the timed closed trades the average actually averages, not
          // every trade in range (open and untimed ones contribute nothing).
          sub={insights.holdCount > 0 ? t`${insights.holdCount} trades` : undefined}
        />
        <StatBar
          label={t`Max drawdown`}
          value={formatPnl(fx(-drawdown), currency)}
          tone={drawdown > 0 ? 'neg' : 'muted'}
        />
        <StatBar
          label={t`Top symbol`}
          value={insights.topSymbol ?? t`None`}
          sub={insights.topSymbol ? t`most traded` : undefined}
          tone={insights.topSymbol ? 'accent' : 'muted'}
        />
        <StatBar
          label={t`Main leak`}
          value={insights.mainMistake ?? t`None tagged`}
          tone={insights.mainMistake ? 'neg' : 'muted'}
        />
      </View>
    </DashboardCard>
  );
}
