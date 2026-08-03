import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { DashboardCard } from '@/components/dashboard-card';
import { t } from '@lingui/core/macro';
import { formatCurrency, formatPercent, formatPnl } from '@/lib/format';
import { pnlColor } from '@/styles/unistyles';

/**
 * Annual goal progress (web `AnnualGoalCard`, display-only — the goal itself is
 * managed on the web app).
 */
export function GoalCard({
  year,
  goalAmount,
  ytdNetPnl,
  currency,
}: {
  year: number;
  goalAmount: number;
  ytdNetPnl: number;
  currency: string;
}) {
  const { theme } = useUnistyles();
  const progress = goalAmount > 0 ? ytdNetPnl / goalAmount : 0;
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <DashboardCard title={t`${year} goal`}>
      <View style={styles.row}>
        <Text selectable style={[styles.ytd, { color: pnlColor(theme.colors, ytdNetPnl) }]}>
          {formatPnl(ytdNetPnl, currency)}
        </Text>
        <Text style={styles.target}>{t`of ${formatCurrency(goalAmount, currency)}`}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
      </View>
      <Text style={styles.caption}>{t`${formatPercent(progress, 0)} of goal · YTD net P&L`}</Text>
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm },
  ytd: { fontSize: 22, fontWeight: '600', ...theme.numeric },
  target: { fontSize: 13, color: theme.colors.mutedForeground, ...theme.numeric },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.muted,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.primary },
  caption: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
}));
