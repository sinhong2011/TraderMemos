import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { BarInterval, MarketBar } from '@/api/types';
import { locale } from '@/i18n';

export const CHART_HEIGHT = 220;
const AXIS_WIDTH = 52;
const TIME_AXIS_HEIGHT = 18;
const PLOT_HEIGHT = CHART_HEIGHT - TIME_AXIS_HEIGHT;

export type ChartPriceLine = { value: number; color: string };
export type ChartMarker = {
  key: string;
  /** Unix seconds of the event; snapped to the nearest bar at or before. */
  timeSec: number;
  isBuy: boolean;
  label: string;
};

function formatAxisPrice(value: number): string {
  return value >= 1000 ? value.toFixed(0) : value.toFixed(2);
}

function formatBarTime(unixSec: number, interval: BarInterval): string {
  const d = new Date(unixSec * 1000);
  return interval === 'D'
    ? d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
    : d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/** Index of the bar an event lands on (nearest bar at or before its timestamp). */
function nearestBarIndex(bars: MarketBar[], unixSec: number): number {
  let idx = 0;
  for (let i = 0; i < bars.length; i++) {
    if (bars[i].time <= unixSec) idx = i;
    else break;
  }
  return idx;
}

/**
 * Candlestick renderer shared by the trade chart and the advanced chart —
 * candles, grid, price lines, fill markers, and the replay cursor are plain
 * positioned Views, so no chart library or native module is needed.
 *
 * Replay: with a `cursor`, bars after it render dimmed and markers past it
 * hide; the price scale stays fixed to the full range so the frame is stable.
 */
export function ChartCanvas({
  bars,
  interval,
  priceLines = [],
  markers = [],
  cursor = null,
}: {
  bars: MarketBar[];
  interval: BarInterval;
  priceLines?: ChartPriceLine[];
  markers?: ChartMarker[];
  cursor?: number | null;
}) {
  const { theme } = useUnistyles();
  const [plotWidth, setPlotWidth] = useState(0);

  const layout = useMemo(() => {
    if (bars.length === 0 || plotWidth <= 0) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const bar of bars) {
      if (bar.low < min) min = bar.low;
      if (bar.high > max) max = bar.high;
    }
    const pad = (max - min || max * 0.01 || 1) * 0.05;
    min -= pad;
    max += pad;
    const y = (value: number) => PLOT_HEIGHT * (1 - (value - min) / (max - min));
    const slot = plotWidth / bars.length;
    const bodyWidth = Math.min(9, Math.max(2, slot * 0.65));
    const x = (index: number) => index * slot + slot / 2;

    // 4 horizontal gridlines at even price steps.
    const gridlines = Array.from({ length: 4 }, (_, i) => {
      const value = min + ((i + 0.5) / 4) * (max - min);
      return { value, top: y(value) };
    });

    return { min, max, y, x, slot, bodyWidth, gridlines };
  }, [bars, plotWidth]);

  const onPlotLayout = (e: LayoutChangeEvent) => setPlotWidth(e.nativeEvent.layout.width);

  const visibleLines = layout
    ? priceLines.filter((line) => line.value > layout.min && line.value < layout.max)
    : [];

  const placedMarkers =
    layout == null
      ? []
      : markers
          .map((marker) => {
            if (
              bars.length === 0 ||
              marker.timeSec < bars[0].time - 60 ||
              marker.timeSec > bars[bars.length - 1].time + 86_400
            ) {
              return null;
            }
            const index = nearestBarIndex(bars, marker.timeSec);
            if (cursor != null && index > cursor) return null;
            const bar = bars[index];
            return {
              key: marker.key,
              left: layout.x(index),
              top: marker.isBuy ? layout.y(bar.low) + 6 : layout.y(bar.high) - 20,
              isBuy: marker.isBuy,
              label: marker.label,
            };
          })
          .filter((m) => m != null);

  if (bars.length === 0 || layout == null) {
    return <View style={styles.placeholder} onLayout={onPlotLayout} />;
  }

  return (
    <View style={styles.chartRow}>
      <View style={styles.plot} onLayout={onPlotLayout}>
        {layout.gridlines.map((line) => (
          <View key={line.value} style={[styles.gridline, { top: line.top }]} />
        ))}
        {bars.map((bar, index) => {
          const rising = bar.close >= bar.open;
          const color = rising ? theme.colors.profit : theme.colors.loss;
          const future = cursor != null && index > cursor;
          const bodyTop = layout.y(Math.max(bar.open, bar.close));
          const bodyHeight = Math.max(1, Math.abs(layout.y(bar.open) - layout.y(bar.close)));
          return (
            <View key={bar.time} style={future ? styles.future : null}>
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
        {cursor != null && cursor >= 0 && cursor < bars.length ? (
          <View
            style={[
              styles.cursorLine,
              { left: layout.x(cursor) - 0.5, backgroundColor: theme.colors.foreground },
            ]}
          />
        ) : null}
        {visibleLines.map((line) => (
          <View
            key={`${line.color}-${line.value}`}
            style={[styles.priceLine, { top: layout.y(line.value), backgroundColor: line.color }]}
          />
        ))}
        {placedMarkers.map((marker) => (
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
          <Text style={styles.timeLabel}>{formatBarTime(bars[0].time, interval)}</Text>
          <Text style={styles.timeLabel}>
            {formatBarTime(bars[Math.floor(bars.length / 2)].time, interval)}
          </Text>
          <Text style={styles.timeLabel}>
            {formatBarTime(bars[bars.length - 1].time, interval)}
          </Text>
        </View>
      </View>
      <View style={styles.axis}>
        {layout.gridlines.map((line) => (
          <Text key={line.value} style={[styles.axisLabel, { top: line.top - 6 }]} numberOfLines={1}>
            {formatAxisPrice(line.value)}
          </Text>
        ))}
        {visibleLines.map((line) => (
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
  );
}

const styles = StyleSheet.create((theme) => ({
  placeholder: { height: CHART_HEIGHT },
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
  future: { opacity: 0.25 },
  cursorLine: {
    position: 'absolute',
    top: 0,
    height: PLOT_HEIGHT,
    width: 1,
    opacity: 0.5,
  },
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
