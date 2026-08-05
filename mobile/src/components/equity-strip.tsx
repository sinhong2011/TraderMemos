import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { ReplayFrame } from '@/lib/replay';

export const STRIP_HEIGHT = 46;
/** Columns to draw at most — one View per bar would be thousands on a daily run. */
const MAX_COLUMNS = 110;

/**
 * The replay's own equity curve, drawn as a column per sampled bar above and
 * below a zero line: green above, red below, the played span solid and the rest
 * ghosted. It is the scrub track as well as the readout — dragging it seeks.
 *
 * Columns rather than a line because there is no SVG dependency in this app
 * (same constraint as `chart-canvas`), and columns survive the sampling: a
 * polyline through every 30th point would lie about the shape between them,
 * whereas a column band reads honestly as a silhouette.
 */
export function EquityStrip({
  frames,
  cursor,
  onScrub,
}: {
  frames: ReplayFrame[];
  cursor: number;
  onScrub?: (index: number) => void;
}) {
  const { theme } = useUnistyles();
  const [width, setWidth] = useState(0);

  const columns = useMemo(() => {
    if (frames.length === 0) return null;
    const count = Math.min(frames.length, MAX_COLUMNS);
    const stride = frames.length / count;
    let extent = 0;
    for (const frame of frames) extent = Math.max(extent, Math.abs(frame.net));
    // A dead-flat run would divide by zero; give it a hairline instead.
    const scale = extent > 0 ? extent : 1;
    const half = STRIP_HEIGHT / 2;

    return Array.from({ length: count }, (_, i) => {
      // Each column stands for a span of bars — take the last, so the final
      // column is always the run's closing figure rather than a sample near it.
      const index = Math.min(Math.round((i + 1) * stride) - 1, frames.length - 1);
      const net = frames[index]!.net;
      const magnitude = Math.max(1, (Math.abs(net) / scale) * (half - 1));
      return {
        index,
        net,
        top: net >= 0 ? half - magnitude : half,
        height: magnitude,
      };
    });
  }, [frames]);

  const scrub = useMemo(() => {
    if (!onScrub || width <= 0 || frames.length === 0) return null;
    const seek = (x: number) => {
      const ratio = Math.min(Math.max(x / width, 0), 1);
      onScrub(Math.round(ratio * (frames.length - 1)));
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
  }, [onScrub, width, frames.length]);

  const onStripLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const strip = (
    <View style={styles.strip} onLayout={onStripLayout}>
      <View style={styles.zeroLine} />
      {columns?.map((column) => (
        <View
          key={column.index}
          style={[
            styles.column,
            // Columns are laid out by flex, so only the bar itself is absolute.
            {
              top: column.top,
              height: column.height,
              backgroundColor: column.net >= 0 ? theme.colors.profit : theme.colors.loss,
            },
            column.index > cursor && styles.future,
          ]}
        />
      ))}
      {width > 0 && frames.length > 1 ? (
        <View
          style={[
            styles.playhead,
            {
              left: (cursor / (frames.length - 1)) * width - 1,
              backgroundColor: theme.colors.foreground,
            },
          ]}
        />
      ) : null}
    </View>
  );

  if (!columns) return <View style={styles.strip} onLayout={onStripLayout} />;
  return scrub ? <GestureDetector gesture={scrub}>{strip}</GestureDetector> : strip;
}

const styles = StyleSheet.create((theme) => ({
  // flex-start, not stretch: each column carries its own height and is then
  // nudged down to straddle the zero line by `top`.
  strip: { height: STRIP_HEIGHT, flexDirection: 'row', alignItems: 'flex-start' },
  /** Columns share the row evenly — `flex: 1` gives each one its slot width. */
  column: { flex: 1, marginHorizontal: 0.5, borderRadius: 1 },
  future: { opacity: 0.22 },
  zeroLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: STRIP_HEIGHT / 2,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  playhead: { position: 'absolute', top: 0, bottom: 0, width: 2, borderRadius: 1, opacity: 0.7 },
}));
