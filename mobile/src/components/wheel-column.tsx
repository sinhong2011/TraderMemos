import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Text,
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { cn } from 'panelui-native';

/**
 * One snapping wheel column — PanelUI's `TimePicker` wheel machinery, extracted
 * (v0.68.0, `components/time-picker`) because the library's `TimeValue` stops
 * at the minute and the fill rows are stamped to the second. The library keeps
 * the column internal, and vendoring the whole picker through `panelui-cli`
 * pulls a parallel copy of Button/Dialog/Popover/portal infrastructure beside
 * the ones the app already runs — one column is the part actually needed.
 *
 * Behaviour is a faithful copy; the styling classes are the library's own
 * slot values, so a column here matches the `DateField` pill's minute wheel.
 */

/** Row height in every scrolling column. Big enough to hit, small enough to see five. */
export const ROW_HEIGHT = 44;
/** Rows visible in a column. Odd, so one of them is the centre. */
const VISIBLE_ROWS = 5;
export const COLUMN_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;

function indexForAccessibilityAction(
  index: number,
  length: number,
  actionName: string,
  disabled = false,
): number | undefined {
  const direction = actionName === 'increment' ? 1 : actionName === 'decrement' ? -1 : 0;
  if (disabled || direction === 0 || length <= 0) return undefined;
  const next = Math.min(Math.max(index + direction, 0), length - 1);
  return next === index ? undefined : next;
}

/** Keep the numeric adjustable range aligned with the values the wheel offers. */
function accessibilityValueForIndex(index: number, length: number, text: string) {
  const max = Math.max(0, length - 1);
  return {
    min: 0,
    max,
    now: Math.min(Math.max(index, 0), max),
    text,
  };
}

interface WheelColumnProps<T> {
  items: readonly T[];
  /** Index of the selected item. Drives the scroll position. */
  index: number;
  onIndexChange: (index: number) => void;
  label: (item: T) => string;
  disabled?: boolean;
  accessibilityLabel: string;
  className?: string;
}

/**
 * A vertical list that comes to rest on a whole row.
 *
 * `snapToOffsets` rather than `snapToInterval`: the two behave the same on a
 * short flick, but an interval lets a hard fling coast past several rows and
 * land between two of them on Android. Explicit offsets plus
 * `disableIntervalMomentum` pin every rest position to a row.
 *
 * Half a column of padding at each end is what lets the first and last items
 * reach the centre — without it, midnight can be scrolled to but never
 * selected, since the list runs out before it gets there.
 */
export function WheelColumn<T>({
  items,
  index,
  onIndexChange,
  label,
  disabled,
  accessibilityLabel,
  className,
}: WheelColumnProps<T>) {
  const ref = useRef<Animated.ScrollView>(null);
  const offset = useSharedValue(index * ROW_HEIGHT);
  /*
   * The index the list is resting on, tracked separately from the `index`
   * prop. Scrolling writes to it, and the effect below only re-scrolls when
   * the prop disagrees — otherwise every settle would push the list back to
   * where it already is, cancelling the user's own momentum.
   */
  const resting = useRef(index);

  const snapToOffsets = useMemo(() => items.map((_, i) => i * ROW_HEIGHT), [items]);

  const handler = useAnimatedScrollHandler((event) => {
    offset.value = event.contentOffset.y;
  });

  /*
   * Whether the list is still moving, and whether it owes itself a correction
   * once it stops.
   *
   * Nothing may scroll the column programmatically while it is gliding. A
   * `scrollTo` issued against a running deceleration fights it, and the list
   * stops dead somewhere between two rows and takes no further touches — a
   * flick reads as the wheel freezing. So a correction that arrives mid-flight
   * is remembered rather than performed, and applied at the moment the list
   * comes to rest.
   */
  const moving = useRef(false);
  const owedResync = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `atRest` runs from a scroll handler long after the render that created it,
  // so it needs the current index rather than the one it captured. Written in
  // the resync effect below (this repo's lint bars ref writes during render).
  const latestIndex = useRef(index);

  const cancelTimer = useCallback(() => {
    if (settleTimer.current === null) return;
    clearTimeout(settleTimer.current);
    settleTimer.current = null;
  }, []);

  /*
   * Unanimated, and that is load-bearing rather than a matter of taste.
   *
   * An animated programmatic scroll raises the same begin and end momentum
   * events a finger does, so the correction reports itself as a gesture, which
   * commits, which corrects again — the column rides up and down and never
   * settles. Placing it outright raises nothing, so the correction ends where
   * it starts.
   */
  const snapTo = useCallback((to: number) => {
    resting.current = to;
    ref.current?.scrollTo({ y: to * ROW_HEIGHT, animated: false });
  }, []);

  useEffect(() => {
    latestIndex.current = index;
    if (index === resting.current) return;
    if (moving.current) {
      owedResync.current = true;
      return;
    }
    snapTo(index);
  }, [index, snapTo]);

  /** The list has genuinely stopped. Pay off a correction if one is owed. */
  const atRest = useCallback(() => {
    cancelTimer();
    moving.current = false;
    if (!owedResync.current) return;
    owedResync.current = false;
    if (latestIndex.current !== resting.current) snapTo(latestIndex.current);
  }, [cancelTimer, snapTo]);

  const startMoving = useCallback(() => {
    cancelTimer();
    moving.current = true;
  }, [cancelTimer]);

  const settleAt = useCallback(
    (y: number) => {
      const next = Math.round(y / ROW_HEIGHT);
      const clamped = Math.min(Math.max(next, 0), items.length - 1);
      if (clamped === resting.current) return;
      resting.current = clamped;
      /*
       * This report supersedes any correction that was owed. The correction was
       * worked out against a row the column has now left, and paying it off
       * afterwards would drag the column back to a row nobody chose.
       */
      owedResync.current = false;
      onIndexChange(clamped);
    },
    [items.length, onIndexChange],
  );

  /*
   * A flick reports once, when it stops — not twice.
   *
   * Momentum begins a frame *after* the drag ends, so the end of a drag cannot
   * tell a flick from a release by itself. It arms a short timer, and momentum
   * starting cancels it; a drag that stops dead has no momentum to cancel it
   * and settles on the timer.
   */
  const onDragEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      cancelTimer();
      settleTimer.current = setTimeout(() => {
        settleAt(y);
        atRest();
      }, 80);
    },
    [atRest, cancelTimer, settleAt],
  );

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      cancelTimer();
      settleAt(event.nativeEvent.contentOffset.y);
      atRest();
    },
    [atRest, cancelTimer, settleAt],
  );

  useEffect(() => cancelTimer, [cancelTimer]);

  const selectedItem = items[index];

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const next = indexForAccessibilityAction(
        index,
        items.length,
        event.nativeEvent.actionName,
        disabled,
      );
      if (next === undefined) return;
      onIndexChange(next);
    },
    [disabled, index, items.length, onIndexChange],
  );

  return (
    <Animated.ScrollView
      ref={ref}
      className={className}
      style={{ height: COLUMN_HEIGHT }}
      contentContainerStyle={{ paddingVertical: (COLUMN_HEIGHT - ROW_HEIGHT) / 2 }}
      contentOffset={{ x: 0, y: index * ROW_HEIGHT }}
      onScroll={handler}
      scrollEventThrottle={16}
      scrollEnabled={!disabled}
      showsVerticalScrollIndicator={false}
      snapToOffsets={snapToOffsets}
      disableIntervalMomentum
      decelerationRate="fast"
      /* Both ends are wired, because only one of them fires: a flick ends in
         momentum, and a slow drag released on a snap point ends without any.
         Missing the drag case leaves a column that looks settled and has
         reported nothing. */
      onScrollBeginDrag={startMoving}
      onScrollEndDrag={onDragEnd}
      onMomentumScrollBegin={startMoving}
      onMomentumScrollEnd={onMomentumEnd}
      /* The rows fade rather than unmount, so a recycled row would pop in at
         full opacity mid-scroll. Sixty views per column is cheaper than the
         flicker. */
      removeClippedSubviews={false}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      accessibilityValue={
        selectedItem
          ? accessibilityValueForIndex(index, items.length, label(selectedItem))
          : undefined
      }
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
    >
      {items.map((item, i) => (
        <ColumnRow key={i} offset={offset} index={i} selected={i === index}>
          {label(item)}
        </ColumnRow>
      ))}
    </Animated.ScrollView>
  );
}

/**
 * One row, faded by how far it is from the centre.
 *
 * The fade is a function of the live scroll offset rather than of the selected
 * index, so it tracks the finger instead of stepping once per settle — which
 * is the difference between a wheel and a list that changes colour.
 */
function ColumnRow({
  offset,
  index,
  selected,
  children,
}: {
  offset: SharedValue<number>;
  index: number;
  selected: boolean;
  children: string;
}) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(offset.value / ROW_HEIGHT - index);
    return {
      opacity: interpolate(distance, [0, 1, 2], [1, 0.75, 0.25], 'clamp'),
      transform: [{ scale: interpolate(distance, [0, 1], [1, 0.94], 'clamp') }],
    };
  });

  return (
    <Animated.View style={[style, { height: ROW_HEIGHT }]} className="items-center justify-center">
      <Text
        className={cn(
          'text-lg tabular-nums text-foreground',
          selected && 'font-semibold text-primary',
        )}
      >
        {children}
      </Text>
    </Animated.View>
  );
}
