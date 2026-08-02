import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useMarketBars } from '@/api/hooks';
import type { BarInterval, MarketBar, TradeDetail } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { Segmented } from '@/components/segmented';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';

const CHART_HEIGHT = 220;
const AXIS_WIDTH = 52;
const TIME_AXIS_HEIGHT = 18;
const PLOT_HEIGHT = CHART_HEIGHT - TIME_AXIS_HEIGHT;

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

function formatAxisPrice(value: number): string {
  return value >= 1000 ? value.toFixed(0) : value.toFixed(2);
}

function formatBarTime(unixSec: number, interval: BarInterval): string {
  const d = new Date(unixSec * 1000);
  return interval === 'D'
    ? d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
    : d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/** Index of the bar a fill lands on (nearest bar at or before its timestamp). */
function nearestBarIndex(bars: MarketBar[], unixSec: number): number {
  let idx = 0;
  for (let i = 0; i < bars.length; i++) {
    if (bars[i].time <= unixSec) idx = i;
    else break;
  }
  return idx;
}

/**
 * Candlestick chart for the trade window — the mobile take on the web
 * TradeChartSection. Bars come from the app's own /market/bars proxy; candles,
 * grid, entry/target/stop lines, and fill markers are plain positioned Views,
 * so no chart library or native module is needed.
 */
export function TradeChart({ trade }: { trade: TradeDetail }) {
  const { theme } = useUnistyles();
  // Open trades chart up to "now", captured once per mount so render stays pure
  // and the query key doesn't churn.
  const [mountedAtMs] = useState(() => Date.now());
  const openedMs = new Date(trade.opened_at).getTime();
  const closedMs = trade.closed_at ? new Date(trade.closed_at).getTime() : mountedAtMs;

  const [interval, setBarInterval] = useState<BarInterval>(() =>
    defaultInterval(openedMs, closedMs),
  );
  const [plotWidth, setPlotWidth] = useState(0);

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

  const layout = useMemo(() => {
    if (data.length === 0 || plotWidth <= 0) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const bar of data) {
      if (bar.low < min) min = bar.low;
      if (bar.high > max) max = bar.high;
    }
    const pad = (max - min || max * 0.01 || 1) * 0.05;
    min -= pad;
    max += pad;
    const y = (value: number) => PLOT_HEIGHT * (1 - (value - min) / (max - min));
    const slot = plotWidth / data.length;
    const bodyWidth = Math.min(9, Math.max(2, slot * 0.65));
    const x = (index: number) => index * slot + slot / 2;

    // 4 horizontal gridlines at even price steps.
    const gridlines = Array.from({ length: 4 }, (_, i) => {
      const value = min + ((i + 0.5) / 4) * (max - min);
      return { value, top: y(value) };
    });

    return { min, max, y, x, slot, bodyWidth, gridlines };
  }, [data, plotWidth]);

  const onPlotLayout = (e: LayoutChangeEvent) => setPlotWidth(e.nativeEvent.layout.width);

  const priceLines = layout
    ? (
        [
          { value: trade.avg_entry_price, color: theme.colors.primary },
          { value: trade.target_price, color: theme.colors.profit },
          { value: trade.stop_price, color: theme.colors.loss },
        ] as const
      ).filter(
        (line): line is { value: number; color: string } =>
          line.value != null && line.value > layout.min && line.value < layout.max,
      )
    : [];

  const markers =
    layout == null
      ? []
      : trade.fills
          .map((fill) => {
            const sec = Math.floor(new Date(fill.executed_at).getTime() / 1000);
            if (data.length === 0 || sec < data[0].time - 60 || sec > data[data.length - 1].time + 86_400) {
              return null;
            }
            const index = nearestBarIndex(data, sec);
            const bar = data[index];
            const isBuy = fill.side === 'buy';
            return {
              key: fill.id,
              left: layout.x(index),
              top: isBuy ? layout.y(bar.low) + 6 : layout.y(bar.high) - 20,
              isBuy,
              label: `${fill.quantity} @ ${fill.price}`,
            };
          })
          .filter((m) => m != null);

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
      ) : data.length === 0 || layout == null ? (
        <View style={styles.placeholder} onLayout={onPlotLayout}>
          <Text style={styles.empty}>{t`No chart data for this symbol.`}</Text>
        </View>
      ) : (
        <View style={styles.chartRow}>
          <View style={styles.plot} onLayout={onPlotLayout}>
            {layout.gridlines.map((line) => (
              <View key={line.value} style={[styles.gridline, { top: line.top }]} />
            ))}
            {data.map((bar, index) => {
              const rising = bar.close >= bar.open;
              const color = rising ? theme.colors.profit : theme.colors.loss;
              const bodyTop = layout.y(Math.max(bar.open, bar.close));
              const bodyHeight = Math.max(
                1,
                Math.abs(layout.y(bar.open) - layout.y(bar.close)),
              );
              return (
                <View key={bar.time}>
                  <View
                    style={[
                      styles.wick,
                      {
                        left: layout.x(index) - 0.5,
                        top: layout.y(bar.high),
                        height: Math.max(1, layout.y(bar.low) - layout.y(bar.high)),
                        backgroundColor: color,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.body,
                      {
                        left: layout.x(index) - layout.bodyWidth / 2,
                        top: bodyTop,
                        width: layout.bodyWidth,
                        height: bodyHeight,
                        backgroundColor: color,
                      },
                    ]}
                  />
                </View>
              );
            })}
            {priceLines.map((line) => (
              <View
                key={`${line.color}-${line.value}`}
                style={[
                  styles.priceLine,
                  { top: layout.y(line.value), backgroundColor: line.color },
                ]}
              />
            ))}
            {markers.map((marker) => (
              <View
                key={marker.key}
                style={[styles.marker, { left: marker.left - 32, top: marker.top }]}
              >
                <SymbolView
                  name={marker.isBuy ? 'arrowtriangle.up.fill' : 'arrowtriangle.down.fill'}
                  size={9}
                  tintColor={marker.isBuy ? theme.colors.profit : theme.colors.mutedForeground}
                />
                <Text style={styles.markerLabel} numberOfLines={1}>
                  {marker.label}
                </Text>
              </View>
            ))}
            <View style={styles.timeAxis}>
              <Text style={styles.timeLabel}>{formatBarTime(data[0].time, interval)}</Text>
              <Text style={styles.timeLabel}>
                {formatBarTime(data[Math.floor(data.length / 2)].time, interval)}
              </Text>
              <Text style={styles.timeLabel}>
                {formatBarTime(data[data.length - 1].time, interval)}
              </Text>
            </View>
          </View>
          <View style={styles.axis}>
            {layout.gridlines.map((line) => (
              <Text
                key={line.value}
                style={[styles.axisLabel, { top: line.top - 6 }]}
                numberOfLines={1}
              >
                {formatAxisPrice(line.value)}
              </Text>
            ))}
            {priceLines.map((line) => (
              <Text
                key={`${line.color}-${line.value}`}
                style={[
                  styles.axisLabel,
                  { top: layout.y(line.value) - 6, color: line.color, fontWeight: '600' },
                ]}
                numberOfLines={1}
              >
                {formatAxisPrice(line.value)}
              </Text>
            ))}
          </View>
        </View>
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
  chartRow: { flexDirection: 'row', height: CHART_HEIGHT },
  plot: { flex: 1, height: CHART_HEIGHT },
  axis: { width: AXIS_WIDTH, height: PLOT_HEIGHT },
  gridline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: theme.colors.border,
    opacity: 0.4,
  },
  wick: { position: 'absolute', width: 1 },
  body: { position: 'absolute', borderRadius: 1 },
  priceLine: { position: 'absolute', left: 0, right: 0, height: 1, opacity: 0.55 },
  marker: {
    position: 'absolute',
    width: 64,
    alignItems: 'center',
    gap: 1,
  },
  markerLabel: { fontSize: 8, color: theme.colors.mutedForeground, ...theme.numeric },
  axisLabel: {
    position: 'absolute',
    right: 0,
    fontSize: 9,
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
  timeAxis: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: TIME_AXIS_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  timeLabel: { fontSize: 9, color: theme.colors.mutedForeground, ...theme.numeric },
}));
