import { useRouter } from 'expo-router';
import { Progress, Skeleton, cn } from 'panelui-native';
import { Text, View } from 'react-native';

import { usePropStatus } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { InlineError } from '@/components/error-state';
import { Pill } from '@/components/pill';
import { StatBar } from '@/components/stat-bar';
import { t } from '@lingui/core/macro';
import { formatPercent, useFormatters } from '@/lib/format';
import { resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';

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
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View className="gap-1">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-[13px] font-medium text-foreground">{label}</Text>
        <Text className={cn('text-xs tabular-nums', danger ? 'text-loss' : 'text-muted-foreground')}>
          {note}
        </Text>
      </View>
      {/* 3% floor so a rule barely underway still reads as a started bar. */}
      <Progress
        value={Math.max(3, clamped * 100)}
        size="sm"
        color={danger ? 'destructive' : 'success'}
      />
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
  const router = useRouter();
  const prefs = useDisplayPrefs();
  const { formatCurrency, formatPnl } = useFormatters();
  const status = usePropStatus(accountId, { tz: resolveMarketTimezone(prefs.marketTimezone) });

  if (status.isLoading) return <Skeleton className="h-[200px] rounded-[18px]" />;
  // Vanishing was defensible while it was the only blank card on screen; with
  // the server down every card beside it is blank too, and a trader on an
  // evaluation is owed a reason rather than a missing drawdown floor. A cached
  // status still renders — the offline banner is what marks it as behind.
  if (status.error && status.data == null) {
    return (
      <DashboardCard title={t`Prop evaluation`}>
        <InlineError error={status.error} onRetry={() => void status.refetch()} />
      </DashboardCard>
    );
  }

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
        <Text className="text-[13px] text-muted-foreground">
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
      flush
    >
      <View className="flex-row flex-wrap gap-2">
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
          tone={s.best_day_pnl > 0 ? 'pos' : 'muted'}
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

      <View className="flex-row flex-wrap gap-1.5">
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
