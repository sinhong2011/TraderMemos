import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { BarInterval, MarketBar } from '@/api/types';
import { locale } from '@/i18n';

export const CHART_HEIGHT = 220;
/** Price gutter on the right — overlays anchor inside it so labels stay clear. */
export const AXIS_WIDTH = 52;
const TIME_AXIS_HEIGHT = 18;

export type ChartPriceLine = { value: number; color: string };
/** A shaded price zone — the risk and reward sides of a trade's plan. */
export type ChartBand = { from: number; to: number; color: string };
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
 * Candlestick renderer shared by the trade chart, the advanced chart, and the
 * replay theater — candles, grid, price lines, plan bands, fill markers, and
 * the replay cursor are plain positioned Views, so no chart library or native
 * module is needed (there is no SVG dependency in this app).
 *
 * Replay: with a `cursor`, bars after it are hidden and markers past it too;
 * the price scale stays fixed to the full range so the frame is stable while
 * it plays. Pass `onScrub` to make the plot itself the scrubber.
 */
export function ChartCanvas({
  bars,
  interval,
  priceLines = [],
  bands = [],
  markers = [],
  cursor = null,
  height = CHART_HEIGHT,
  surface,
  onScrub,
}: {
  bars: MarketBar[];
  interval: BarInterval;
  priceLines?: ChartPriceLine[];
  bands?: ChartBand[];
  markers?: ChartMarker[];
  cursor?: number | null;
  height?: number;
  /**
   * Colour behind the chart, used to veil the unplayed bars. Defaults to the
   * card surface; the full-screen theater sits on the page instead.
   */
  surface?: string;
  /** Drag or tap anywhere on the plot to move the replay cursor. */
  onScrub?: (index: number) => void;
}) {
  const { theme } = useUnistyles();
  const [plotWidth, setPlotWidth] = useState(0);
  const plotHeight = height - TIME_AXIS_HEIGHT;

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
    const y = (value: number) => plotHeight * (1 - (value - min) / (max - min));
    const slot = plotWidth / bars.length;
    const bodyWidth = Math.min(9, Math.max(2, slot * 0.65));
    const x = (index: number) => index * slot + slot / 2;

    // 4 horizontal gridlines at even price steps.
    const gridlines = Array.from({ length: 4 }, (_, i) => {
      const value = min + ((i + 0.5) / 4) * (max - min);
      return { value, top: y(value) };
    });

    return { min, max, y, x, slot, bodyWidth, gridlines };
  }, [bars, plotWidth, plotHeight]);

  const onPlotLayout = (e: LayoutChangeEvent) => setPlotWidth(e.nativeEvent.layout.width);

  // Deliberately independent of `cursor` — the candles are the same picture at
  // every frame of a replay, so they are built once per bar set and the cursor
  // only moves the veil and the crosshair over them.
  const candles = useMemo(() => {
    if (!layout) return null;
    return bars.map((bar, index) => {
      const color = bar.close >= bar.open ? theme.colors.profit : theme.colors.loss;
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
                top: layout.y(Math.max(bar.open, bar.close)),
                width: layout.bodyWidth,
                height: Math.max(1, Math.abs(layout.y(bar.open) - layout.y(bar.close))),
                backgroundColor: color,
              },
            ]}
          />
        </View>
      );
    });
  }, [bars, layout, theme.colors.profit, theme.colors.loss]);

  // Scrubbing maps an x offset back to a bar. Recreated whenever the geometry
  // changes so the closure never seeks against a stale slot width.
  const scrub = useMemo(() => {
    if (!onScrub || !layout || bars.length === 0) return null;
    const seek = (x: number) => {
      const index = Math.round(x / layout.slot - 0.5);
      onScrub(Math.min(Math.max(index, 0), bars.length - 1));
    };
    return (
      Gesture.Pan()
        .minDistance(0)
        // `seek` closes over React state and calls back into React — the babel
        // plugin would otherwise workletize these handlers and the UI runtime
        // would throw on the synchronous call to a remote function.
        .runOnJS(true)
        .onBegin((e) => seek(e.x))
        .onUpdate((e) => seek(e.x))
    );
  }, [onScrub, layout, bars.length]);

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
    return <View style={{ height }} onLayout={onPlotLayout} />;
  }

  const cursorBar = cursor != null && cursor >= 0 && cursor < bars.length ? bars[cursor] : null;

  const plot = (
    <View style={[styles.plot, { height }]} onLayout={onPlotLayout}>
      {/* Plan bands sit under the candles — context, not foreground. */}
      {bands.map((band) => {
        const top = Math.min(layout.y(band.from), layout.y(band.to));
        const bottom = Math.max(layout.y(band.from), layout.y(band.to));
        const clippedTop = Math.max(top, 0);
        const clippedHeight = Math.min(bottom, plotHeight) - clippedTop;
        if (clippedHeight <= 0) return null;
        return (
          <View
            key={`${band.color}-${band.from}-${band.to}`}
            style={[
              styles.band,
              { top: clippedTop, height: clippedHeight, backgroundColor: band.color },
            ]}
          />
        );
      })}
      {layout.gridlines.map((line) => (
        <View key={line.value} style={[styles.gridline, { top: line.top }]} />
      ))}
      {candles}
      {/* The unplayed tape is covered by one moving pane rather than by
          slicing the candle list: playback moves this View instead of
          rebuilding several hundred, which is what keeps 10× smooth. */}
      {cursorBar ? (
        <View
          style={[
            styles.curtain,
            {
              left: layout.x(cursor!) + layout.slot / 2,
              height: plotHeight,
              backgroundColor: surface ?? theme.colors.card,
            },
          ]}
        />
      ) : null}
      {cursorBar ? (
        <>
          <View
            style={[
              styles.cursorLine,
              {
                left: layout.x(cursor!) - 0.5,
                height: plotHeight,
                backgroundColor: theme.colors.foreground,
              },
            ]}
          />
          {/* Marks the close the P&L readout is marked to, so the number and
              the candle can't be read as belonging to different bars. */}
          <View
            style={[
              styles.cursorDot,
              {
                left: layout.x(cursor!) - 3,
                top: layout.y(cursorBar.close) - 3,
                backgroundColor: theme.colors.foreground,
              },
            ]}
          />
        </>
      ) : null}
      {visibleLines.map((line) => (
        <View
          key={`${line.color}-${line.value}`}
          style={[styles.priceLine, { top: layout.y(line.value), backgroundColor: line.color }]}
        />
      ))}
      {placedMarkers.map((marker) => (
        <View key={marker.key} style={[styles.marker, { left: marker.left - 32, top: marker.top }]}>
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
        <Text style={styles.timeLabel}>{formatBarTime(bars[bars.length - 1].time, interval)}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.chartRow, { height }]}>
      {scrub ? <GestureDetector gesture={scrub}>{plot}</GestureDetector> : plot}
      <View style={[styles.axis, { height: plotHeight }]}>
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
        {cursorBar ? (
          <View style={[styles.cursorChip, { top: layout.y(cursorBar.close) - 9 }]}>
            <Text style={styles.cursorChipLabel} numberOfLines={1}>
              {formatAxisPrice(cursorBar.close)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  chartRow: { flexDirection: 'row' },
  plot: { flex: 1 },
  axis: { width: AXIS_WIDTH },
  band: { position: 'absolute', left: 0, right: 0, opacity: 0.1 },
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
  // 0.75 over the surface leaves the future tape at the same quarter-strength
  // the per-candle opacity used to give it.
  // Opaque, not tinted: a replay whose next candles are legible through the
  // veil answers the question before you have played it.
  curtain: { position: 'absolute', top: 0, right: 0 },
  cursorLine: { position: 'absolute', top: 0, width: 1, opacity: 0.5 },
  cursorDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  priceLine: { position: 'absolute', left: 0, right: 0, height: 1, opacity: 0.55 },
  marker: { position: 'absolute', width: 64, alignItems: 'center', gap: 1 },
  markerLabel: { fontSize: 8, color: theme.colors.mutedForeground, ...theme.numeric },
  axisLabel: {
    position: 'absolute',
    right: 0,
    fontSize: 9,
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
  // The cursor's own price reads as a chip so it wins against the axis ticks
  // it inevitably overlaps as the replay runs.
  cursorChip: {
    position: 'absolute',
    right: 0,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.foreground,
  },
  cursorChipLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.colors.background,
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
