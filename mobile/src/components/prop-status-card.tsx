import { useRouter } from 'expo-router';
import { RingChart, Skeleton, cn } from 'panelui-native';
import { Text, View } from 'react-native';

import { usePropStatus } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { InlineError } from '@/components/error-state';
import { Pill } from '@/components/pill';
import { StatBar } from '@/components/stat-bar';
import { t } from '@lingui/core/macro';
import { formatPercent, useFormatters } from '@/lib/format';
import { resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';
import { usePnlPalette } from '@/styles/pnl';

/** Diameter of the evaluation rings; two arcs plus a center readout fit here. */
const RING_SIZE = 96;

/** One evaluation rule drawn as a ring: its arc, and the legend row beside. */
type RuleRing = {
  key: string;
  label: string;
  /** 0–1 fill of the arc. */
  progress: number;
  color: string;
  note: string;
  danger?: boolean;
};

/**
 * The two evaluation rules as concentric rings — progress towards several
 * targets is RingChart's literal shape. The green arc closes on the profit
 * target; the red one is drawdown allowance being consumed, so a full red
 * ring is the failure state. The notes the old bars carried move into a
 * legend column beside the dial.
 */
function RuleRings({ rings }: { rings: RuleRing[] }) {
  const center = rings[0];
  return (
    <View className="flex-row items-center gap-4">
      <RingChart
        data={rings.map((ring) => ({
          label: ring.label,
          value: Math.min(1, Math.max(0, ring.progress)),
          maxValue: 1,
          color: ring.color,
        }))}
        size={RING_SIZE}
        strokeWidth={9}
      >
        {rings.map((ring, index) => (
          <RingChart.Ring key={ring.key} index={index} />
        ))}
        <RingChart.Center>
          {() => (
            <Text className="text-[13px] font-semibold tabular-nums text-foreground">
              {formatPercent(Math.min(1, Math.max(0, center.progress)), 0)}
            </Text>
          )}
        </RingChart.Center>
      </RingChart>
      <View className="flex-1 gap-2.5">
        {rings.map((ring) => (
          <View
            key={ring.key}
            className="gap-0.5"
            accessible
            accessibilityLabel={`${ring.label}, ${ring.note}`}
          >
            <View className="flex-row items-center gap-1.5">
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: ring.color }} />
              <Text className="text-[13px] font-medium text-foreground">{ring.label}</Text>
            </View>
            <Text
              className={cn(
                'text-xs tabular-nums',
                ring.danger ? 'text-loss' : 'text-muted-foreground',
              )}
            >
              {ring.note}
            </Text>
          </View>
        ))}
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
  const router = useRouter();
  const prefs = useDisplayPrefs();
  const palette = usePnlPalette();
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

  const rings: RuleRing[] = [];
  if (s.profit_target != null && s.profit_target > 0) {
    rings.push({
      key: 'target',
      label: t`Profit target`,
      progress: s.target_pct ?? 0,
      color: palette.profit,
      note: s.target_reached
        ? t`reached`
        : t`${formatPercent(s.target_pct ?? 0, 0)} of ${formatCurrency(fx(s.profit_target), currency)}`,
    });
  }
  if (s.max_drawdown != null && s.max_drawdown > 0) {
    rings.push({
      key: 'drawdown',
      label: t`Drawdown (${drawdownModeLabel})`,
      progress:
        s.floor_distance != null ? 1 - s.floor_distance / s.max_drawdown : s.drawdown_hit ? 1 : 0,
      color: palette.loss,
      note: s.drawdown_hit
        ? t`floor hit`
        : s.floor_distance != null
          ? t`${formatCurrency(fx(s.floor_distance), currency)} above the floor`
          : '',
      danger: floorDanger,
    });
  }

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

      {rings.length > 0 ? <RuleRings rings={rings} /> : null}

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
