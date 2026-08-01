import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { Summary, Trade } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { StatBar } from '@/components/stat-bar';
import { t } from '@lingui/core/macro';
import { computeDashboardInsights } from '@/lib/insights';
import { formatDate, formatDuration, formatPnl } from '@/lib/format';

/**
 * The web dashboard's insight bento, folded into a phone-width tile grid:
 * edge quality, streak stability, holds, and leaks.
 */
export function InsightsCard({
  summary,
  trades,
  currency,
  maxDrawdown,
}: {
  summary: Summary;
  trades: Trade[];
  currency: string;
  maxDrawdown?: number;
}) {
  const insights = computeDashboardInsights(trades);

  return (
    <DashboardCard title={t`Insights`}>
      <View style={styles.grid}>
        <StatBar
          label={t`Best trade`}
          value={summary.largest_win > 0 ? formatPnl(summary.largest_win, currency) : '—'}
          tone="pos"
        />
        <StatBar
          label={t`Worst trade`}
          value={summary.largest_loss > 0 ? formatPnl(-summary.largest_loss, currency) : '—'}
          tone="neg"
        />
        <StatBar
          label={t`Max drawdown`}
          value={maxDrawdown != null && maxDrawdown > 0 ? formatPnl(-maxDrawdown, currency) : '—'}
          tone="neg"
        />
        <StatBar
          label={t`Best streak`}
          value={insights.bestStreak > 0 ? String(insights.bestStreak) : '—'}
          sub={insights.bestStreak > 0 ? t`wins` : undefined}
          tone="pos"
        />
        <StatBar
          label={t`Worst streak`}
          value={insights.worstStreak > 0 ? String(insights.worstStreak) : '—'}
          sub={insights.worstStreak > 0 ? t`losses` : undefined}
          tone={insights.worstStreak > 0 ? 'neg' : 'muted'}
        />
        <StatBar
          label={t`Best day`}
          value={insights.bestDay ? formatPnl(insights.bestDay.pnl, currency) : '—'}
          sub={insights.bestDay ? formatDate(insights.bestDay.date) : undefined}
          tone={insights.bestDay && insights.bestDay.pnl > 0 ? 'pos' : 'muted'}
        />
        <StatBar
          label={t`Worst day`}
          value={insights.worstDay ? formatPnl(insights.worstDay.pnl, currency) : '—'}
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
          value={insights.topSymbol ?? '—'}
          sub={insights.topSymbol ? t`most traded` : undefined}
          tone="accent"
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
