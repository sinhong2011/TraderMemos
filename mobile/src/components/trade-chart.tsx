import { useRouter } from 'expo-router';
import { Skeleton } from 'panelui-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import type { TradeDetail } from '@/api/types';
import {
  ChartCanvas,
  CHART_HEIGHT,
  type ChartBand,
  type ChartMarker,
} from '@/components/chart-canvas';
import { DashboardCard } from '@/components/dashboard-card';
import { Segmented } from '@/components/segmented';
import { t } from '@lingui/core/macro';
import { BAR_INTERVALS, useTradeBars } from '@/lib/trade-bars';
import { usePnlPalette } from '@/styles/pnl';

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
  const router = useRouter();
  const palette = usePnlPalette();
  const [primary, background] = useCSSVariable(['--color-primary', '--color-background']) as [
    string,
    string,
  ];
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
    { value: trade.avg_entry_price, color: primary },
    ...(trade.target_price != null ? [{ value: trade.target_price, color: palette.profit }] : []),
    ...(trade.stop_price != null ? [{ value: trade.stop_price, color: palette.loss }] : []),
  ];

  const bands: ChartBand[] = [
    ...(trade.stop_price != null
      ? [{ from: trade.avg_entry_price, to: trade.stop_price, color: palette.loss }]
      : []),
    ...(trade.target_price != null
      ? [{ from: trade.avg_entry_price, to: trade.target_price, color: palette.profit }]
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
            className="flex-row items-center gap-[5px] rounded-full bg-foreground px-[9px] py-[5px] active:opacity-70"
          >
            <Icon name="play.fill" size={10} tintColor={background} />
            <Text className="text-[11px] font-semibold text-background">{t`Replay`}</Text>
          </Pressable>
        ) : null
      }
    >
      {bars.isLoading ? (
        <Skeleton className="h-[220px] rounded-lg" label={t`Loading chart`} />
      ) : bars.bars.length === 0 ? (
        <View className="items-center justify-center" style={{ height: CHART_HEIGHT }}>
          <Text className="text-[13px] text-muted-foreground">{t`No chart data for this symbol.`}</Text>
        </View>
      ) : (
        // The plot itself stays a target, the way a video thumbnail is — the
        // header badge is what says so.
        <Pressable
          onPress={() => router.push({ pathname: '/replay', params: { id: trade.id } })}
          disabled={!canReplay}
          accessibilityRole="button"
          accessibilityLabel={t`Replay this trade`}
          className="active:opacity-70"
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
      <View className="items-center">
        <Segmented compact options={BAR_INTERVALS} value={bars.interval} onChange={bars.pickInterval} />
      </View>
    </DashboardCard>
  );
}
