import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { BehaviorReport, ComplianceReport, Summary } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { Pill } from '@/components/pill';
import { Skeleton } from '@/components/skeleton';
import { StatBar } from '@/components/stat-bar';
import { t } from '@lingui/core/macro';
import { formatPercent, formatPnl } from '@/lib/format';
import { useDisplayPrefs } from '@/lib/prefs';

/**
 * The day's four numbers, then the two questions a review has to answer beyond
 * P&L: was it inside the rules, and did it look like tilt.
 */
export function SessionCard({
  date,
  summary,
  loading,
  compliance,
  behavior,
  currency,
  fxRate = 1,
}: {
  /** "YYYY-MM-DD" in the market timezone. */
  date: string;
  summary?: Summary;
  loading: boolean;
  compliance?: ComplianceReport;
  behavior?: BehaviorReport;
  currency: string;
  /** Base→display conversion applied before formatting (1 = account currency). */
  fxRate?: number;
}) {
  // Re-render when privacy mode flips — formatters read it at call time.
  useDisplayPrefs();
  const day = compliance?.days.find((d) => d.date === date);
  const netPnl = (summary?.net_pnl ?? 0) * fxRate;
  const trades = summary?.total_trades ?? 0;
  const revenge = behavior?.revenge.events.length ?? 0;
  const oversized = behavior?.overconfidence.events.length ?? 0;
  const givenBack = behavior?.loss_aversion.give_back_count ?? 0;

  if (loading) {
    return (
      <DashboardCard title={t`Session summary`}>
        <Skeleton style={styles.skeleton} />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title={t`Session summary`}>
      <View style={styles.grid}>
        <StatBar
          label={t`Net P&L`}
          value={formatPnl(netPnl, currency)}
          tone={netPnl >= 0 ? 'pos' : 'neg'}
        />
        <StatBar label={t`Trades`} value={String(trades)} />
        <StatBar label={t`Win rate`} value={formatPercent(summary?.win_rate ?? 0)} />
        <StatBar
          label={t`Fees`}
          value={formatPnl(-(summary?.total_fees ?? 0) * fxRate, currency)}
        />
      </View>

      {compliance?.rules_configured ? (
        <View style={styles.pills}>
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

      {revenge + oversized + givenBack > 0 ? (
        <View style={styles.pills}>
          {revenge > 0 ? <Pill tone="amber">{t`revenge trades ×${revenge}`}</Pill> : null}
          {oversized > 0 ? (
            <Pill tone="amber">{t`oversized after streak ×${oversized}`}</Pill>
          ) : null}
          {givenBack > 0 ? (
            <Pill tone="amber">{t`profit given back ×${givenBack}`}</Pill>
          ) : null}
        </View>
      ) : null}

    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
  },
  skeleton: { height: 120 },
}));
