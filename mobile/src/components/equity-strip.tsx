import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useCSSVariable } from 'uniwind';

import type { ReplayFrame } from '@/lib/replay';
import { usePnlPalette } from '@/styles/pnl';

export const STRIP_HEIGHT = 46;
/** Columns to draw at most — one View per bar would be thousands on a daily run. */
const MAX_COLUMNS = 110;

/**
 * The replay's own equity curve, drawn as a column per sampled bar above and
 * below a zero line: green above, red below, the played span solid and the rest
 * ghosted. It is the scrub track as well as the readout — dragging it seeks.
 *
 * Columns rather than a PanelUI series because this is a *control*: the
 * playhead, the ghosted future and the pan-to-seek gesture are the point, and
 * no chart in the registry hands those over. Columns also survive the sampling
 * a line would lie about: a polyline through every 30th point invents the shape
 * between them, whereas a column band reads honestly as a silhouette.
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
  const palette = usePnlPalette();
  const [foreground] = useCSSVariable(['--color-foreground']) as [string];
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
    // flex-start, not stretch: each column carries its own height and is then
    // nudged down to straddle the zero line by `top`.
    <View
      className="flex-row items-start"
      style={{ height: STRIP_HEIGHT }}
      onLayout={onStripLayout}
    >
      <View
        className="absolute left-0 right-0 h-px bg-border"
        style={{ top: STRIP_HEIGHT / 2 }}
      />
      {columns?.map((column) => (
        <View
          key={column.index}
          // Columns share the row evenly — `flex-1` gives each one its slot
          // width; only the bar itself is absolutely placed.
          className="mx-[0.5px] flex-1 rounded-[1px]"
          style={[
            {
              top: column.top,
              height: column.height,
              backgroundColor: column.net >= 0 ? palette.profit : palette.loss,
            },
            column.index > cursor && { opacity: 0.22 },
          ]}
        />
      ))}
      {width > 0 && frames.length > 1 ? (
        <View
          className="absolute bottom-0 top-0 w-0.5 rounded-[1px] opacity-70"
          style={{
            left: (cursor / (frames.length - 1)) * width - 1,
            backgroundColor: foreground,
          }}
        />
      ) : null}
    </View>
  );

  if (!columns) {
    return (
      <View className="flex-row items-start" style={{ height: STRIP_HEIGHT }} onLayout={onStripLayout} />
    );
  }
  return scrub ? <GestureDetector gesture={scrub}>{strip}</GestureDetector> : strip;
}
