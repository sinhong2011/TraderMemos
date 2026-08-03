import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { usePropStatus } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { Pill } from '@/components/pill';
import { Skeleton } from '@/components/skeleton';
import { StatBar } from '@/components/stat-bar';
import { t } from '@lingui/core/macro';
import { formatCurrency, formatPercent, formatPnl } from '@/lib/format';
import { resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';
import { pnlColor } from '@/styles/unistyles';

function RuleBar({
  label,
  progress,
  note,
  danger,
}: {
  label: string;
  /** 0–1 fill. */
  progress: number;
  note: string;
  danger?: boolean;
}) {
  const { theme } = useUnistyles();
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View style={styles.rule}>
      <View style={styles.ruleHead}>
        <Text style={styles.ruleLabel}>{label}</Text>
        <Text style={[styles.ruleNote, danger ? { color: theme.colors.loss } : null]}>{note}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.max(3, clamped * 100)}%`,
              backgroundColor: danger ? theme.colors.loss : theme.colors.profit,
            },
          ]}
        />
      </View>
    </View>
  );
}

/**
 * Prop-firm evaluation card (web PropStatusCard) — server-computed status,
 * never re-derived client-side. Renders only for a scoped prop account;
 * unconfigured rules become the setup prompt.
 */
export function PropStatusCard({
  accountId,
  currency,
  fxRate = 1,
}: {
  accountId: string;
  currency: string;
  /** Base→display conversion applied before formatting (1 = account currency). */
  fxRate?: number;
}) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const prefs = useDisplayPrefs();
  const status = usePropStatus(accountId, { tz: resolveMarketTimezone(prefs.marketTimezone) });

  if (status.isLoading) return <Skeleton style={styles.skeleton} />;
  if (status.error) return null;

  const data = status.data;
  if (!data) return null;

  if (!data.configured || !data.status) {
    return (
      <DashboardCard
        title={t`Prop evaluation`}
        action={{
          label: t`Set up rules`,
          onPress: () =>
            router.push({ pathname: '/prop-settings', params: { accountId } }),
        }}
      >
        <Text style={styles.empty}>
          {t`Define the profit target, drawdown, and daily-loss rules to track this evaluation.`}
        </Text>
      </DashboardCard>
    );
  }

  const s = data.status;
  const fx = (v: number) => v * fxRate;
  const floorDanger =
    s.drawdown_hit ||
    (s.max_drawdown != null &&
      s.max_drawdown > 0 &&
      s.floor_distance != null &&
      s.floor_distance <= 0.25 * s.max_drawdown);

  const drawdownModeLabel =
    s.drawdown_mode === 'eod'
      ? t`EOD trailing`
      : s.drawdown_mode === 'static'
        ? t`static`
        : t`trailing`;

  return (
    <DashboardCard
      title={t`Prop evaluation`}
      action={{
        label: t`Rules`,
        onPress: () => router.push({ pathname: '/prop-settings', params: { accountId } }),
      }}
    >
      <View style={styles.grid}>
        <StatBar label={t`Equity`} value={formatCurrency(fx(s.equity), currency)} tone="accent" />
        <StatBar
          label={t`Realized P&L`}
          value={formatPnl(fx(s.realized_pnl), currency)}
          tone={s.realized_pnl >= 0 ? 'pos' : 'neg'}
        />
        <StatBar label={t`Trading days`} value={String(s.trading_days)} />
        <StatBar
          label={t`Best day`}
          value={formatPnl(fx(s.best_day_pnl), currency)}
          sub={s.best_day_share != null ? t`${formatPercent(s.best_day_share, 0)} of profit` : undefined}
          tone={pnlColor(theme.colors, s.best_day_pnl) === theme.colors.profit ? 'pos' : 'muted'}
        />
      </View>

      {s.profit_target != null && s.profit_target > 0 ? (
        <RuleBar
          label={t`Profit target`}
          progress={s.target_pct ?? 0}
          note={
            s.target_reached
              ? t`reached`
              : t`${formatPercent(s.target_pct ?? 0, 0)} of ${formatCurrency(fx(s.profit_target), currency)}`
          }
        />
      ) : null}

      {s.max_drawdown != null && s.max_drawdown > 0 ? (
        <RuleBar
          label={t`Drawdown (${drawdownModeLabel})`}
          progress={
            s.floor_distance != null ? 1 - s.floor_distance / s.max_drawdown : s.drawdown_hit ? 1 : 0
          }
          note={
            s.drawdown_hit
              ? t`floor hit`
              : s.floor_distance != null
                ? t`${formatCurrency(fx(s.floor_distance), currency)} above the floor`
                : ''
          }
          danger={floorDanger}
        />
      ) : null}

      <View style={styles.pills}>
        {s.target_reached ? <Pill tone="pos">{t`target reached`}</Pill> : null}
        {s.drawdown_hit ? <Pill tone="neg">{t`drawdown floor hit`}</Pill> : null}
        {s.daily_loss_hits > 0 ? <Pill tone="neg">{t`daily loss ×${s.daily_loss_hits}`}</Pill> : null}
        {s.consistency_ok === false ? (
          <Pill tone="amber">{t`consistency rule at risk`}</Pill>
        ) : s.consistency_ok === true ? (
          <Pill tone="pos">{t`consistency ok`}</Pill>
        ) : null}
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  rule: { gap: theme.spacing.xs },
  ruleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  ruleLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.foreground },
  ruleNote: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.muted,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs + 2 },
  empty: { fontSize: 13, color: theme.colors.mutedForeground },
  skeleton: { height: 200, borderRadius: theme.radius.lg + 4 },
}));
