import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { Summary, Trade } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { StatBar } from '@/components/stat-bar';
import { t } from '@lingui/core/macro';
import { computeDashboardInsights } from '@/lib/insights';
import { formatDate, formatDuration, formatPnl } from '@/lib/format';
import { useDisplayPrefs } from '@/lib/prefs';

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
  useDisplayPrefs();
  const insights = computeDashboardInsights(trades);
  const fx = (v: number) => v * fxRate;

  return (
    <DashboardCard title={t`Insights`}>
      <View style={styles.grid}>
        <StatBar
          label={t`Best trade`}
          value={formatPnl(fx(summary.largest_win), currency)}
          tone="pos"
        />
        <StatBar
          label={t`Worst trade`}
          value={formatPnl(fx(-summary.largest_loss), currency)}
          tone="neg"
        />
        <StatBar
          label={t`Max drawdown`}
          value={formatPnl(fx(-(maxDrawdown ?? 0)), currency)}
          tone="neg"
        />
        <StatBar
          label={t`Best streak`}
          value={String(insights.bestStreak)}
          sub={t`wins`}
          tone="pos"
        />
        <StatBar
          label={t`Worst streak`}
          value={String(insights.worstStreak)}
          sub={t`losses`}
          tone={insights.worstStreak > 0 ? 'neg' : 'muted'}
        />
        <StatBar
          label={t`Best day`}
          value={formatPnl(fx(insights.bestDay?.pnl ?? 0), currency)}
          sub={insights.bestDay ? formatDate(insights.bestDay.date) : undefined}
          tone={insights.bestDay && insights.bestDay.pnl > 0 ? 'pos' : 'muted'}
        />
        <StatBar
          label={t`Worst day`}
          value={formatPnl(fx(insights.worstDay?.pnl ?? 0), currency)}
          sub={insights.worstDay ? formatDate(insights.worstDay.date) : undefined}
          tone={insights.worstDay && insights.worstDay.pnl < 0 ? 'neg' : 'muted'}
        />
        <StatBar
          label={t`Avg hold`}
          value={formatDuration(insights.avgHoldSecs)}
          sub={t`${summary.total_trades} trades`}
        />
        <StatBar label={t`Winning hold`} value={formatDuration(insights.winHoldSecs)} tone="pos" />
        <StatBar label={t`Losing hold`} value={formatDuration(insights.lossHoldSecs)} tone="neg" />
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

const styles = StyleSheet.create((theme) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
}));
