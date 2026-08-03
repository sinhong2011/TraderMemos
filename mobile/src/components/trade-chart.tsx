import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useMarketBars } from '@/api/hooks';
import type { BarInterval, TradeDetail } from '@/api/types';
import { ChartCanvas, CHART_HEIGHT, type ChartMarker } from '@/components/chart-canvas';
import { DashboardCard } from '@/components/dashboard-card';
import { ReplayControls } from '@/components/replay-controls';
import { Segmented } from '@/components/segmented';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { formatPnl } from '@/lib/format';
import { useDisplayPrefs } from '@/lib/prefs';
import { computeReplayPnl, detectFillBarMismatch, useReplayController } from '@/lib/replay';
import { pnlColor } from '@/styles/unistyles';

/** Same thresholds as web defaultBarInterval: pick resolution from trade duration. */
function defaultInterval(fromMs: number, toMs: number): BarInterval {
  const ms = Math.max(toMs - fromMs, 60_000);
  if (ms <= 2 * 3_600_000) return '1';
  if (ms <= 8 * 3_600_000) return '5';
  if (ms <= 3 * 86_400_000) return '15';
  if (ms <= 14 * 86_400_000) return '60';
  return 'D';
}

/** Snap to the minute so the query key (and the server cache key) stays stable. */
function snapToMinute(ms: number): string {
  const d = new Date(ms);
  d.setSeconds(0, 0);
  return d.toISOString();
}

/**
 * Candlestick chart for the trade window (canvas shared with the advanced
 * chart) plus bar-by-bar replay: play through the trade with a running
 * mark-to-market P&L readout, mirroring the web TradeChartReplay.
 */
export function TradeChart({ trade }: { trade: TradeDetail }) {
  const { theme } = useUnistyles();
  useDisplayPrefs();
  // Open trades chart up to "now", captured once per mount so render stays pure
  // and the query key doesn't churn.
  const [mountedAtMs] = useState(() => Date.now());
  const openedMs = new Date(trade.opened_at).getTime();
  const closedMs = trade.closed_at ? new Date(trade.closed_at).getTime() : mountedAtMs;

  const [interval, setBarInterval] = useState<BarInterval>(() =>
    defaultInterval(openedMs, closedMs),
  );

  const bars = useMarketBars({
    symbol: trade.symbol,
    instrumentType: trade.instrument_type,
    interval,
    from: snapToMinute(openedMs),
    to: snapToMinute(closedMs),
  });

  const intervals: { value: BarInterval; label: string }[] = [
    { value: '1', label: '1m' },
    { value: '5', label: '5m' },
    { value: '15', label: '15m' },
    { value: '60', label: '1H' },
    { value: '240', label: '4H' },
    { value: 'D', label: '1D' },
  ];

  const rawBars = bars.data?.bars;
  const data = useMemo(() => rawBars ?? [], [rawBars]);

  // Short trades outside market hours can have zero bars at the auto-picked
  // fine interval — step up to coarser candles until something renders. A
  // manual interval pick turns this off.
  const autoEscalate = useRef(true);
  useEffect(() => {
    if (!autoEscalate.current || !bars.data || bars.data.bars.length > 0) return;
    const order: BarInterval[] = ['1', '5', '15', '60', '240', 'D'];
    const next = order[order.indexOf(interval) + 1];
    if (!next) return;
    // Deferred so the escalation reads as an async reaction to the server
    // response, not a render-cascading synchronous setState.
    const timer = setTimeout(() => setBarInterval(next), 0);
    return () => clearTimeout(timer);
  }, [bars.data, interval]);

  const replay = useReplayController(data.length);
  const replayPnl = replay.active
    ? computeReplayPnl(trade.fills, data, replay.cursor, interval)
    : null;
  const mismatch =
    replay.active && data.length > 0 && detectFillBarMismatch(trade.fills, data, interval);

  const priceLines = [
    { value: trade.avg_entry_price, color: theme.colors.primary },
    ...(trade.target_price != null
      ? [{ value: trade.target_price, color: theme.colors.profit }]
      : []),
    ...(trade.stop_price != null ? [{ value: trade.stop_price, color: theme.colors.loss }] : []),
  ];

  const markers: ChartMarker[] = trade.fills.map((fill) => ({
    key: fill.id,
    timeSec: Math.floor(new Date(fill.executed_at).getTime() / 1000),
    isBuy: fill.side === 'buy',
    label: `${fill.quantity} @ ${fill.price}`,
  }));

  return (
    <DashboardCard
      title={t`Chart`}
      control={
        <Segmented
          options={intervals}
          value={interval}
          onChange={(next) => {
            autoEscalate.current = false;
            setBarInterval(next);
          }}
        />
      }
    >
      {bars.isLoading ? (
        <Skeleton style={styles.placeholder} />
      ) : data.length === 0 ? (
        <View style={styles.placeholder}>
          <Text style={styles.empty}>{t`No chart data for this symbol.`}</Text>
        </View>
      ) : (
        <>
          <ChartCanvas
            bars={data}
            interval={interval}
            priceLines={priceLines}
            markers={markers}
            cursor={replay.active ? replay.cursor : null}
          />
          {!replay.active && data.length > 1 ? (
            <Pressable
              onPress={replay.start}
              hitSlop={8}
              accessibilityRole="button"
              style={({ pressed }) => [styles.replayLink, pressed && styles.pressed]}
            >
              <Text style={styles.replayLabel}>{t`Replay trade`} ›</Text>
            </Pressable>
          ) : null}
          {replay.active ? (
            <>
              {replayPnl ? (
                <Text style={styles.readout}>
                  <Text style={[styles.readoutNet, { color: pnlColor(theme.colors, replayPnl.net) }]}>
                    {formatPnl(replayPnl.net, trade.pnl_currency)}
                  </Text>
                  {'  '}
                  {replayPnl.position !== 0
                    ? t`${replayPnl.position} open @ ${replayPnl.avgCost.toFixed(2)}`
                    : t`flat`}{' '}
                  · {t`${replayPnl.fillCount} fills`}
                </Text>
              ) : null}
              {mismatch ? (
                <Text style={styles.footnote}>
                  {t`Fill prices disagree with the tape — replay P&L is approximate until the exit.`}
                </Text>
              ) : null}
              <ReplayControls controller={replay} barCount={data.length} />
            </>
          ) : null}
        </>
      )}
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  placeholder: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { fontSize: 13, color: theme.colors.mutedForeground },
  readout: { fontSize: 13, color: theme.colors.mutedForeground, ...theme.numeric },
  readoutNet: { fontSize: 15, fontWeight: '600' },
  footnote: { fontSize: 12, color: theme.colors.mutedForeground },
  replayLink: { alignSelf: 'flex-start' },
  pressed: { opacity: 0.6 },
  replayLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.foreground },
}));
