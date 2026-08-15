import { useMemo, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import type { BarInterval, MarketBar } from '@/api/types';
import { locale } from '@/i18n';
import { usePnlPalette } from '@/styles/pnl';

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
  /** Overrides the buy/sell tint — the symbol journal colors fills by outcome. */
  color?: string;
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
 * the replay cursor are plain positioned Views.
 *
 * Deliberately *not* PanelUI's `CandlestickChart`: that draws candles, a grid,
 * axes and a tooltip and nothing else. It has no reference/price lines, no
 * shaded bands, no markers and no cursor — and those four overlays *are* this
 * component (a trade's plan drawn on its tape). Swapping the candles for it
 * would mean losing them, so the hand-drawn plot stays and only its colors moved
 * onto the theme tokens.
 *
 * Replay: with a `cursor`, bars after it are hidden and markers past it too;
 * the price scale stays fixed to the full range so the frame is stable while
 * it plays. Pass `onScrub` to make the plot itself the scrubber.
 *
 * Blind replay (the backtester) is the exception: there the unplayed tape must
 * not exist at all — see `blind`.
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
  blind = false,
  onScrub,
  onMarkerPress,
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
  /**
   * Draw only the bars up to the cursor, and derive the price scale and the
   * time axis from those alone. A veiled future is still a *known* future: a
   * fixed scale leaks the run's high and low, and the axis leaks where it ends.
   * The backtester needs the chart to know as little as the trader does, so it
   * refits as each bar arrives.
   */
  blind?: boolean;
  /** Drag or tap anywhere on the plot to move the replay cursor. */
  onScrub?: (index: number) => void;
  /**
   * Makes each marker its own tap target (called with the marker's key) — the
   * symbol journal jumps from a fill to its trade. Inner Pressables win over
   * a plot-level one, so the rest of the plot keeps its own handler.
   */
  onMarkerPress?: (key: string) => void;
}) {
  const palette = usePnlPalette();
  const [foreground, card, mutedForeground] = useCSSVariable([
    '--color-foreground',
    '--color-card',
    '--color-muted-foreground',
  ]) as [string, string, string];
  const [plotWidth, setPlotWidth] = useState(0);
  const plotHeight = height - TIME_AXIS_HEIGHT;

  // Everything below reads `shown`, never `bars` — in blind mode the tape past
  // the cursor is not drawn, scaled against, or labelled.
  const shown = useMemo(
    () => (blind && cursor != null ? bars.slice(0, Math.max(cursor + 1, 1)) : bars),
    [blind, bars, cursor],
  );

  const layout = useMemo(() => {
    if (shown.length === 0 || plotWidth <= 0) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const bar of shown) {
      if (bar.low < min) min = bar.low;
      if (bar.high > max) max = bar.high;
    }
    const pad = (max - min || max * 0.01 || 1) * 0.05;
    min -= pad;
    max += pad;
    const y = (value: number) => plotHeight * (1 - (value - min) / (max - min));
    const slot = plotWidth / shown.length;
    const bodyWidth = Math.min(9, Math.max(2, slot * 0.65));
    const x = (index: number) => index * slot + slot / 2;

    // 4 horizontal gridlines at even price steps.
    const gridlines = Array.from({ length: 4 }, (_, i) => {
      const value = min + ((i + 0.5) / 4) * (max - min);
      return { value, top: y(value) };
    });

    return { min, max, y, x, slot, bodyWidth, gridlines };
  }, [shown, plotWidth, plotHeight]);

  const onPlotLayout = (e: LayoutChangeEvent) => setPlotWidth(e.nativeEvent.layout.width);

  // Independent of `cursor` outside blind mode — the candles are the same
  // picture at every frame of a replay, so they are built once per bar set and
  // the cursor only moves the veil and the crosshair over them. Blind mode is
  // the exception by construction: `shown` grows a bar at a time, so the list
  // (and the refitted scale under it) is rebuilt per step.
  const candles = useMemo(() => {
    if (!layout) return null;
    return shown.map((bar, index) => {
      const color = bar.close >= bar.open ? palette.profit : palette.loss;
      return (
        <View key={bar.time}>
          <View
            className="absolute w-px"
            style={{
              left: layout.x(index) - 0.5,
              top: layout.y(bar.high),
              height: Math.max(1, layout.y(bar.low) - layout.y(bar.high)),
              backgroundColor: color,
            }}
          />
          <View
            className="absolute rounded-[1px]"
            style={{
              left: layout.x(index) - layout.bodyWidth / 2,
              top: layout.y(Math.max(bar.open, bar.close)),
              width: layout.bodyWidth,
              height: Math.max(1, Math.abs(layout.y(bar.open) - layout.y(bar.close))),
              backgroundColor: color,
            }}
          />
        </View>
      );
    });
  }, [shown, layout, palette.profit, palette.loss]);

  // Scrubbing maps an x offset back to a bar. Recreated whenever the geometry
  // changes so the closure never seeks against a stale slot width.
  const scrub = useMemo(() => {
    if (!onScrub || !layout || shown.length === 0) return null;
    const seek = (x: number) => {
      const index = Math.round(x / layout.slot - 0.5);
      onScrub(Math.min(Math.max(index, 0), shown.length - 1));
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
  }, [onScrub, layout, shown.length]);

  const visibleLines = layout
    ? priceLines.filter((line) => line.value > layout.min && line.value < layout.max)
    : [];

  const placedMarkers =
    layout == null
      ? []
      : markers
          .map((marker) => {
            if (
              shown.length === 0 ||
              marker.timeSec < shown[0].time - 60 ||
              marker.timeSec > shown[shown.length - 1].time + 86_400
            ) {
              return null;
            }
            const index = nearestBarIndex(shown, marker.timeSec);
            if (cursor != null && index > cursor) return null;
            const bar = shown[index];
            return {
              key: marker.key,
              left: layout.x(index),
              top: marker.isBuy ? layout.y(bar.low) + 6 : layout.y(bar.high) - 20,
              isBuy: marker.isBuy,
              label: marker.label,
              color: marker.color,
            };
          })
          .filter((m) => m != null);

  if (shown.length === 0 || layout == null) {
    return <View style={{ height }} onLayout={onPlotLayout} />;
  }

  const cursorBar = cursor != null && cursor >= 0 && cursor < shown.length ? shown[cursor] : null;

  const plot = (
    <View className="flex-1" style={{ height }} onLayout={onPlotLayout}>
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
            className="absolute left-0 right-0 opacity-10"
            style={{ top: clippedTop, height: clippedHeight, backgroundColor: band.color }}
          />
        );
      })}
      {layout.gridlines.map((line) => (
        <View
          key={line.value}
          className="absolute left-0 right-0 h-px bg-border opacity-40"
          style={{ top: line.top }}
        />
      ))}
      {candles}
      {/* The unplayed tape is covered by one moving pane rather than by
          slicing the candle list: playback moves this View instead of
          rebuilding several hundred, which is what keeps 10× smooth.
          Opaque, not tinted: a replay whose next candles are legible through
          the veil answers the question before you have played it. */}
      {/* Nothing to veil in blind mode — the cursor bar *is* the last one drawn. */}
      {cursorBar && !blind ? (
        <View
          className="absolute right-0 top-0"
          style={{
            left: layout.x(cursor!) + layout.slot / 2,
            height: plotHeight,
            backgroundColor: surface ?? card,
          }}
        />
      ) : null}
      {cursorBar ? (
        <>
          <View
            className="absolute top-0 w-px opacity-50"
            style={{
              left: layout.x(cursor!) - 0.5,
              height: plotHeight,
              backgroundColor: foreground,
            }}
          />
          {/* Marks the close the P&L readout is marked to, so the number and
              the candle can't be read as belonging to different bars. */}
          <View
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{
              left: layout.x(cursor!) - 3,
              top: layout.y(cursorBar.close) - 3,
              backgroundColor: foreground,
            }}
          />
        </>
      ) : null}
      {visibleLines.map((line) => (
        <View
          key={`${line.color}-${line.value}`}
          className="absolute left-0 right-0 h-px opacity-[0.55]"
          style={{ top: layout.y(line.value), backgroundColor: line.color }}
        />
      ))}
      {placedMarkers.map((marker) => {
        const glyph = (
          <>
            <Icon
              name={marker.isBuy ? 'arrowtriangle.up.fill' : 'arrowtriangle.down.fill'}
              size={9}
              tintColor={marker.color ?? (marker.isBuy ? palette.profit : mutedForeground)}
            />
            <Text className="text-[8px] tabular-nums text-muted-foreground" numberOfLines={1}>
              {marker.label}
            </Text>
          </>
        );
        return onMarkerPress ? (
          <Pressable
            key={marker.key}
            onPress={() => onMarkerPress(marker.key)}
            hitSlop={8}
            accessibilityRole="button"
            className="absolute w-16 items-center gap-px active:opacity-50"
            style={{ left: marker.left - 32, top: marker.top }}
          >
            {glyph}
          </Pressable>
        ) : (
          <View
            key={marker.key}
            className="absolute w-16 items-center gap-px"
            style={{ left: marker.left - 32, top: marker.top }}
          >
            {glyph}
          </View>
        );
      })}
      <View
        className="absolute bottom-0 left-0 right-0 flex-row items-end justify-between"
        style={{ height: TIME_AXIS_HEIGHT }}
      >
        <Text className="text-[9px] tabular-nums text-muted-foreground">
          {formatBarTime(shown[0].time, interval)}
        </Text>
        <Text className="text-[9px] tabular-nums text-muted-foreground">
          {formatBarTime(shown[Math.floor(shown.length / 2)].time, interval)}
        </Text>
        <Text className="text-[9px] tabular-nums text-muted-foreground">
          {formatBarTime(shown[shown.length - 1].time, interval)}
        </Text>
      </View>
    </View>
  );

  return (
    <View className="flex-row" style={{ height }}>
      {scrub ? <GestureDetector gesture={scrub}>{plot}</GestureDetector> : plot}
      <View style={{ width: AXIS_WIDTH, height: plotHeight }}>
        {layout.gridlines.map((line) => (
          <Text
            key={line.value}
            className="absolute right-0 text-[9px] tabular-nums text-muted-foreground"
            style={{ top: line.top - 6 }}
            numberOfLines={1}
          >
            {formatAxisPrice(line.value)}
          </Text>
        ))}
        {visibleLines.map((line) => (
          <Text
            key={`${line.color}-${line.value}`}
            className="absolute right-0 text-[9px] font-semibold tabular-nums"
            style={{ top: layout.y(line.value) - 6, color: line.color }}
            numberOfLines={1}
          >
            {formatAxisPrice(line.value)}
          </Text>
        ))}
        {/* The cursor's own price reads as a chip so it wins against the axis
            ticks it inevitably overlaps as the replay runs. */}
        {cursorBar ? (
          <View
            className="absolute right-0 rounded-sm bg-foreground px-1 py-px"
            style={{ top: layout.y(cursorBar.close) - 9 }}
          >
            <Text
              className="text-[9px] font-semibold tabular-nums text-background"
              numberOfLines={1}
            >
              {formatAxisPrice(cursorBar.close)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
