import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { Pressable, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { cn } from 'panelui-native';
import { useCSSVariable } from 'uniwind';

/**
 * Swipe — the app's one swipeable row.
 *
 * The API is PanelUI's (`Swipe.Start` / `Swipe.End` holding `Swipe.Action`s,
 * actions offered to screen readers as accessibility actions on the row), but
 * the gesture underneath is RNGH's `ReanimatedSwipeable`: transform-only
 * reveal that never re-runs layout mid-drag, `friction` gearing so the row has
 * weight under the finger, and RNGH's own scroll coordination. PanelUI's
 * `Swipe` animates the panel's *width*, which relayouts the tiles every frame
 * and stutters on Android — its feel constants are module-private, so this
 * wrapper replaces it rather than tuning it.
 *
 * Actions draw as detached squircle tiles floating in the revealed gap (the
 * trade-form fill-card style), not edge-to-edge colour slabs: icon only, the
 * label is what a screen reader is offered.
 *
 * There is no full swipe: every outermost action in the app is destructive-ish
 * (remove, revoke, close a position), and none should fire from a hard drag
 * alone.
 *
 * RNGH is patched (patches/react-native-gesture-handler.patch): on Android an
 * opacity-0 action layer still receives touches, and the hidden side's layer
 * sits above the open side's in z-order — every leading tile was untappable
 * (gesture-handler#3223). The patch is upstream PR #4192's pointerEvents
 * toggle; drop it when the SDK pin reaches a release that includes it.
 */

/** Squircle corners on the action tiles — no Tailwind utility maps to this. */
const CONTINUOUS = { borderCurve: 'continuous' } as const;

/** How big a glyph draws on a tile; matched to the 72pt tile, not inline text. */
const ICON_SIZE = 18;

export interface SwipeHandle {
  /** Slide the row aside to reveal one side's actions. */
  open: (side: 'start' | 'end') => void;
  /** Put the row back. */
  close: () => void;
}

const SwipeContext = createContext<{ close: () => void } | null>(null);

/* -------------------------------------------------------------------------- */
/* Action                                                                     */
/* -------------------------------------------------------------------------- */

export type SwipeActionColor =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'info'
  | 'destructive';

/**
 * Full-strength status fills, never tints: a tile only exists while the row is
 * out of the way, so it has to be legible the moment it appears.
 */
const FILL: Record<SwipeActionColor, string> = {
  default: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
  destructive: 'bg-destructive',
};

export interface SwipeActionProps {
  className?: string;
  /** What the action does. Icon-only tiles: this is what a screen reader gets. */
  label: string;
  /** The glyph, bare — the tile sizes and tints it itself. */
  icon?: ReactNode;
  /** Run when the tile is tapped. */
  onPress?: () => void;
  /**
   * Leave the row open after the action runs. Off by default; on for an action
   * that unmounts the row with its own exit animation, where the close spring
   * would fight the exit.
   */
  keepOpen?: boolean;
  color?: SwipeActionColor;
}

function SwipeAction({
  className,
  label,
  icon,
  onPress,
  keepOpen = false,
  color = 'default',
}: SwipeActionProps) {
  const swipe = useContext(SwipeContext);
  // `primary-foreground` is the theme's on-fill ink in both schemes; `default`
  // is a mid grey and takes the background colour instead.
  const [onFill, background] = useCSSVariable([
    '--color-primary-foreground',
    '--color-background',
  ]) as [string, string];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        if (!keepOpen) swipe?.close();
        onPress?.();
      }}
      className={cn(
        'w-[72px] items-center justify-center rounded-[20px] active:opacity-60',
        FILL[color],
        className,
      )}
      style={CONTINUOUS}
    >
      {sizeIcon(icon, color === 'default' ? background : onFill)}
    </Pressable>
  );
}

/** The icon at tile size and tint, unless the caller already chose either. */
function sizeIcon(icon: ReactNode, tint: string): ReactNode {
  if (!isValidElement<{ size?: number; tintColor?: string }>(icon)) return icon;
  return cloneElement(icon, {
    size: icon.props.size ?? ICON_SIZE,
    tintColor: icon.props.tintColor ?? tint,
  });
}

/* -------------------------------------------------------------------------- */
/* Panels                                                                     */
/* -------------------------------------------------------------------------- */

interface SwipePanelProps {
  children?: ReactNode;
}

/**
 * Markers, not renderers: the root lifts their children into the RNGH action
 * renderers. Declaring them as elements is how a caller says which side an
 * action belongs to, and keeps both sides readable in source.
 */
function SwipeStart(_props: SwipePanelProps): ReactNode {
  return null;
}

function SwipeEnd(_props: SwipePanelProps): ReactNode {
  return null;
}

/**
 * The revealed tiles, gated on the row's actual translation.
 *
 * RNGH hides its own action layer with `opacity: progress === 0 ? 0 : 1` — an
 * exact-zero test against a spring-driven value. A settle that leaves any
 * residue, or a spring cut short by list recycling, parks that layer at full
 * opacity behind the row, where a row whose press feedback dims it
 * (`active:opacity-70`) lets the tiles ghost through. (Its `reset()` doesn't
 * even zero the right panel's progress.) The row's translation is the honest
 * signal — a row sitting at 0 is closed, whatever the progress values say —
 * so this layer re-hides itself from that.
 */
function Panel({
  translation,
  side,
  children,
}: {
  translation: SharedValue<number>;
  side: 'start' | 'end';
  children: ReactNode;
}) {
  const hidden = useAnimatedStyle(() => ({
    opacity: Math.abs(translation.value) < 1 ? 0 : 1,
  }));

  return (
    <Animated.View
      className={cn(
        'flex-row items-stretch gap-2',
        side === 'start' ? 'pr-2' : 'pl-2',
      )}
      style={hidden}
    >
      {children}
    </Animated.View>
  );
}

/**
 * The actions a panel declared, for the accessibility fallback. Only direct
 * `Swipe.Action` children count — anything else in a panel is decoration.
 */
function collectActions(node: ReactNode): { label: string; onPress?: () => void }[] {
  const found: { label: string; onPress?: () => void }[] = [];
  for (const child of Children.toArray(node)) {
    if (!isValidElement(child) || child.type !== SwipeAction) continue;
    const { label, onPress } = (child as ReactElement<SwipeActionProps>).props;
    found.push({ label, onPress });
  }
  return found;
}

/* -------------------------------------------------------------------------- */
/* Root                                                                       */
/* -------------------------------------------------------------------------- */

export interface SwipeProps {
  ref?: Ref<SwipeHandle>;
  className?: string;
  /**
   * The row itself, plus a `Swipe.Start` and/or `Swipe.End` holding its
   * actions. Order does not matter — the panels are recognised by type.
   */
  children?: ReactNode;
  /**
   * The identity of what this row shows — pass the item's id in any recycling
   * list (FlashList). Recycling hands an instance a different item without
   * remounting it, so an open (or mid-spring) swipe would carry over to the
   * new row; a changed key snaps the row shut instantly, springs and all.
   */
  resetKey?: string | number;
}

function SwipeRoot({ ref, className, children, resetKey }: SwipeProps) {
  const methods = useRef<SwipeableMethods>(null);

  useEffect(() => {
    if (resetKey !== undefined) methods.current?.reset();
  }, [resetKey]);

  const { startNode, endNode, row } = useMemo(() => {
    let start: ReactNode = null;
    let end: ReactNode = null;
    const rest: ReactNode[] = [];

    for (const child of Children.toArray(children)) {
      if (isValidElement(child) && child.type === SwipeStart) {
        start = (child as ReactElement<SwipePanelProps>).props.children;
      } else if (isValidElement(child) && child.type === SwipeEnd) {
        end = (child as ReactElement<SwipePanelProps>).props.children;
      } else {
        rest.push(child);
      }
    }

    return { startNode: start, endNode: end, row: rest };
  }, [children]);

  useImperativeHandle(ref, () => ({
    open: (side) => {
      if (side === 'start') methods.current?.openLeft();
      else methods.current?.openRight();
    },
    close: () => methods.current?.close(),
  }));

  const context = useMemo(() => ({ close: () => methods.current?.close() }), []);

  /**
   * A swipe is invisible to a screen reader, so every action is offered as an
   * accessibility action on the row as well — there is no other way to reach
   * a tile that stays off screen until a gesture nobody announced.
   */
  const allActions = useMemo(
    () => [...collectActions(startNode), ...collectActions(endNode)],
    [startNode, endNode],
  );

  return (
    <SwipeContext.Provider value={context}>
      <View
        accessibilityActions={
          allActions.length > 0
            ? allActions.map(({ label }) => ({ name: label, label }))
            : undefined
        }
        onAccessibilityAction={(event) => {
          allActions
            .find(({ label }) => label === event.nativeEvent.actionName)
            ?.onPress?.();
        }}
        className={className}
      >
        <ReanimatedSwipeable
          ref={methods}
          friction={2}
          leftThreshold={40}
          rightThreshold={40}
          overshootLeft={false}
          overshootRight={false}
          renderLeftActions={
            startNode
              ? (_progress, translation) => (
                  <Panel translation={translation} side="start">
                    {startNode}
                  </Panel>
                )
              : undefined
          }
          renderRightActions={
            endNode
              ? (_progress, translation) => (
                  <Panel translation={translation} side="end">
                    {endNode}
                  </Panel>
                )
              : undefined
          }
        >
          {row}
        </ReanimatedSwipeable>
      </View>
    </SwipeContext.Provider>
  );
}

export const Swipe = Object.assign(SwipeRoot, {
  Start: SwipeStart,
  End: SwipeEnd,
  Action: SwipeAction,
});
