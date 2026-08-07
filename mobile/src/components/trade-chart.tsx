import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { TradeDetail } from '@/api/types';
import {
  ChartCanvas,
  CHART_HEIGHT,
  type ChartBand,
  type ChartMarker,
} from '@/components/chart-canvas';
import { DashboardCard } from '@/components/dashboard-card';
import { Segmented } from '@/components/segmented';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { BAR_INTERVALS, useTradeBars } from '@/lib/trade-bars';

/**
 * The trade's candles with its plan drawn on them: entry, stop and target as
 * lines, and the risk and reward sides shaded so the position reads as
 * territory rather than three stray levels.
 *
 * Replay is deliberately *not* here. It used to be — a transport, a scrubber,
 * a P&L readout and a speed picker crammed under a 220pt chart, all fighting
 * one card's width. It now lives on its own full-screen route, which this card
 * hands off to.
 */
export function TradeChart({ trade }: { trade: TradeDetail }) {
  const { theme } = useUnistyles();
  const router = useRouter();
  // Open trades chart up to "now", captured once per mount so render stays pure
  // and the query key doesn't churn.
  const [mountedAtMs] = useState(() => Date.now());
  const openedMs = new Date(trade.opened_at).getTime();
  const closedMs = trade.closed_at ? new Date(trade.closed_at).getTime() : mountedAtMs;

  const bars = useTradeBars({
    symbol: trade.symbol,
    instrumentType: trade.instrument_type,
    fromMs: openedMs,
    toMs: closedMs,
  });

  const priceLines = [
    { value: trade.avg_entry_price, color: theme.colors.primary },
    ...(trade.target_price != null
      ? [{ value: trade.target_price, color: theme.colors.profit }]
      : []),
    ...(trade.stop_price != null ? [{ value: trade.stop_price, color: theme.colors.loss }] : []),
  ];

  const bands: ChartBand[] = [
    ...(trade.stop_price != null
      ? [{ from: trade.avg_entry_price, to: trade.stop_price, color: theme.colors.loss }]
      : []),
    ...(trade.target_price != null
      ? [{ from: trade.avg_entry_price, to: trade.target_price, color: theme.colors.profit }]
      : []),
  ];

  const markers: ChartMarker[] = trade.fills.map((fill) => ({
    key: fill.id,
    timeSec: Math.floor(new Date(fill.executed_at).getTime() / 1000),
    isBuy: fill.side === 'buy',
    label: `${fill.quantity} @ ${fill.price}`,
  }));

  const canReplay = bars.bars.length > 1;

  return (
    <DashboardCard
      title={t`Chart`}
      // Top-right of the card, on the title's line: the badge used to float over
      // the candles, where it covered a fill marker at the right edge.
      control={
        canReplay ? (
          <Pressable
            onPress={() => router.push({ pathname: '/replay', params: { id: trade.id } })}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t`Replay this trade`}
            style={({ pressed }) => [styles.replayBadge, pressed && styles.pressed]}
          >
            <SymbolView name="play.fill" size={10} tintColor={theme.colors.background} />
            <Text style={styles.replayLabel}>{t`Replay`}</Text>
          </Pressable>
        ) : null
      }
    >
      {bars.isLoading ? (
        <Skeleton style={styles.placeholder} />
      ) : bars.bars.length === 0 ? (
        <View style={styles.placeholder}>
          <Text style={styles.empty}>{t`No chart data for this symbol.`}</Text>
        </View>
      ) : (
        // The plot itself stays a target, the way a video thumbnail is — the
        // header badge is what says so.
        <Pressable
          onPress={() => router.push({ pathname: '/replay', params: { id: trade.id } })}
          disabled={!canReplay}
          accessibilityRole="button"
          accessibilityLabel={t`Replay this trade`}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ChartCanvas
            bars={bars.bars}
            interval={bars.interval}
            priceLines={priceLines}
            bands={bands}
            markers={markers}
          />
        </Pressable>
      )}

      {/* Under the plot rather than in the card header: the interval is
          something you change while looking at the candles, not a header
          caption, and it leaves the top corner to the replay badge. Outside the
          branch above so it is still there to change when a window came back
          empty. */}
      <View style={styles.intervalRow}>
        <Segmented options={BAR_INTERVALS} value={bars.interval} onChange={bars.pickInterval} />
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  placeholder: { height: CHART_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 13, color: theme.colors.mutedForeground },
  pressed: { opacity: 0.7 },
  intervalRow: { alignItems: 'center' },
  replayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.foreground,
  },
  replayLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.background },
}));
