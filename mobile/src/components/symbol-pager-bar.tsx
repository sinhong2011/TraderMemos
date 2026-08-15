
import { cn } from 'panelui-native';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { GlassIconButton } from '@/components/glass-button';

/**
 * One fluid motion for the whole tab strip: SwiftUI's `.smooth` spring model
 * (perceptual duration + damping ratio rather than stiffness/mass), damped just
 * under critical so everything glides to rest without a bounce. DESIGN.md's
 * 150ms ease-out rule is written for the web; app motion here is springs.
 */
export const TAB_SPRING = { duration: 420, dampingRatio: 0.85 } as const;

/**
 * Entering tabs grow open from zero width on the strip's spring while they
 * fade in — the exact mirror of `tabCollapse`, so add and remove read as the
 * same liquid motion. Fade/scale alone left the width to snap in one frame:
 * the capsule jumped wider, then a ghost faded into the already-open gap.
 * `targetWidth` seeds the spring's destination; the slot wrapper clips the
 * label while the capsule is still opening.
 */
function tabEnter(values: { targetWidth: number }) {
  'worklet';
  return {
    initialValues: { opacity: 0, width: 0, transform: [{ scale: 0.92 }] },
    animations: {
      opacity: withTiming(1, { duration: 200 }),
      width: withSpring(values.targetWidth, TAB_SPRING),
      transform: [{ scale: withSpring(1, TAB_SPRING) }],
    },
  };
}

/** Mirror of the entrance, quicker — a removed glyph shouldn't linger. */
function tabExit() {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: 140 }),
      transform: [{ scale: withTiming(0.92, { duration: 140 }) }],
    },
  };
}

/**
 * Removing a tab: it squeezes shut on the very spring that carries its
 * neighbours into the gap, so the strip closes as one motion. Previously the
 * chip blinked out in 140ms and left a hole that the 420ms layout spring then
 * spent three times as long closing — two animations, visibly out of step.
 * `currentWidth` is what makes it possible: an exiting view is detached from
 * layout, so without seeding its measured width there is nothing to animate
 * from. The wrapper clips (`overflow-hidden`) so the label is wiped rather than
 * spilling out of the shrinking capsule.
 */
function tabCollapse(values: { currentWidth: number }) {
  'worklet';
  return {
    initialValues: { opacity: 1, width: values.currentWidth, transform: [{ scale: 1 }] },
    animations: {
      // Fades well before the width lands, so the ghost never sits on top of
      // the neighbour sliding underneath it.
      opacity: withTiming(0, { duration: 160 }),
      width: withSpring(0, TAB_SPRING),
      transform: [{ scale: withSpring(0.9, TAB_SPRING) }],
    },
  };
}

/**
 * One tab. The selection fill is an animated layer rather than a conditional
 * background: removing the active tab hands the highlight to its neighbour,
 * and swapping that on instantly reads as a second jump landing on top of the
 * collapse.
 */
function SymbolTab({
  label,
  isActive,
  removable,
  removeLabel,
  onPress,
  onLongPress,
  onRemove,
}: {
  label: string;
  isActive: boolean;
  removable: boolean;
  removeLabel: string;
  onPress: () => void;
  onLongPress?: () => void;
  onRemove: () => void;
}) {
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  /**
   * Seeded at the tab's *current* selection so the fill is simply there on the
   * first frame. Springing straight from `useAnimatedStyle` instead — the
   * previous form — starts from the static style's `opacity: 0` and fades the
   * active tab's fill in over 420ms every single time the bar mounts, which on
   * a freshly opened form reads as the chip arriving late. The spring belongs
   * to a *change* of selection, so it lives in the effect.
   */
  const selected = useSharedValue(isActive ? 1 : 0);
  useEffect(() => {
    selected.value = withSpring(isActive ? 1 : 0, TAB_SPRING);
  }, [isActive, selected]);
  const fill = useAnimatedStyle(() => ({ opacity: selected.value }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      // 34 + 3pt of capsule padding either side lines the tab strip up with the
      // 40pt glass "+" button beside it.
      className={cn(
        'min-h-[34px] min-w-[44px] flex-row items-center justify-center gap-1.5 rounded-full px-3',
        'active:opacity-60',
      )}
    >
      {/* Starts hidden so the animated opacity has a defined origin — otherwise
          a freshly mounted inactive tab paints one filled frame before it
          settles. */}
      <Animated.View
        pointerEvents="none"
        className="absolute inset-0 rounded-full bg-segment-active opacity-0"
        style={fill}
      />
      <Text
        className={cn(
          'max-w-[140px] text-[13px]',
          isActive ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
      {isActive && removable ? (
        <Animated.View entering={tabEnter} exiting={tabExit}>
          <Pressable
            onPress={onRemove}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={removeLabel}
            className="active:opacity-60"
          >
            <Icon name="xmark.circle.fill" size={15} tintColor={mutedForeground} />
          </Pressable>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

export type PagerTab = {
  key: string;
  label: string;
  /** Never offers the inline clear glyph — a page the form always owns (the
   * daily log's own recap sits at index 0 alongside its symbol pages). */
  fixed?: boolean;
};

/**
 * Page-switcher strip for a `PagerView` — a filled segmented capsule
 * (deliberately distinct from the bordered tag chips: this switches pages, it
 * doesn't toggle values). Follows the iOS token-field idiom: the selected tab
 * reveals its own inline clear glyph, and appending lives in a separate glass
 * button pinned right of the capsule so it stays reachable once the tabs
 * overflow and scroll.
 *
 * Shared by the trade form's per-symbol blocks and the daily log's per-symbol
 * recaps — the two places where one form edits a variable list of symbols.
 *
 * Hand-built rather than PanelUI `Tabs`: the tabs are a variable list with a
 * per-tab remove affordance and add/remove motion of their own, none of which
 * a fixed segmented set models. `PagerTabs` is the `Tabs` case.
 */
export function SymbolPagerBar({
  tabs,
  active,
  addLabel,
  removeLabel,
  keepLast = true,
  onSelect,
  onLongPressTab,
  onAdd,
  onRemoveActive,
}: {
  tabs: PagerTab[];
  active: number;
  /** Accessibility label for the trailing glass "+". */
  addLabel: string;
  /** Accessibility label for the active tab's inline clear glyph. */
  removeLabel: string;
  /**
   * Whether the last removable page has to stay. A trade needs at least one
   * symbol; a daily log's per-symbol recaps are optional to the last one.
   */
  keepLast?: boolean;
  onSelect: (index: number) => void;
  /**
   * Secondary action on a tab, where the page carries a name of its own the
   * form has no other place for (the R calculator renames its positions here).
   * Symbol pages label themselves from their ticker field and pass nothing.
   */
  onLongPressTab?: (index: number) => void;
  onAdd: () => void;
  onRemoveActive: () => void;
}) {
  const removable = tabs.filter((tab) => !tab.fixed).length > (keepLast ? 1 : 0);
  return (
    <View className="flex-row items-center gap-3">
      {/*
       * `tabEnter` describes a tab being *added* — it opens from zero width. On
       * mount there is nothing being added, so `skipEntering` suppresses it for
       * the tabs already present when the bar appears; tabs added later still
       * animate, which is the case the animation was written for.
       */}
      <LayoutAnimationConfig skipEntering>
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Filled tab capsule — the page-switcher family (segmented control),
          // kept visually apart from the bordered tag chips which toggle
          // values. `fill` is the same system fill as a compact picker's pill,
          // so the strip sits in the same control family as the form's other
          // capsules.
          className="shrink grow-0 rounded-full bg-fill"
          contentContainerClassName="flex-row items-center gap-0.5 p-[3px]"
          // Without this a scroll view eats the first tap while a field is open —
          // switching pages mid-typing took two taps, the first one going nowhere
          // but the keyboard.
          keyboardShouldPersistTaps="handled"
          // Deliberately *no* `layout` here, nor on the tabs below. A
          // `LinearTransition` interpolates from the view's previous frame, and
          // on mount there isn't one, so it animates out of an empty rect: on
          // the track that dragged the chip ~23pt downwards, and on each tab it
          // grew the capsule open from zero width. Both were measured
          // frame-by-frame on a freshly pushed form, and the strip is supposed
          // to be simply *there* when the screen arrives.
          //
          // The cost is that neighbours no longer glide into a gap on
          // add/remove — the tab being added still opens via `tabEnter` and the
          // one leaving still collapses via `tabCollapse`, but the others snap.
          // Re-adding `layout` reintroduces the on-open motion; gating it behind
          // a mount flag does not help either, because `onLayout` fires before
          // the layout pass that actually misfires.
        >
          {tabs.map((tab, index) => (
            // Clips the label while `tabCollapse` squeezes the slot shut.
            <Animated.View
              key={tab.key}
              className="overflow-hidden"
              entering={tabEnter}
              exiting={tabCollapse}
            >
              <SymbolTab
                label={tab.label}
                isActive={index === active}
                removable={removable && !tab.fixed}
                removeLabel={removeLabel}
                onPress={() => onSelect(index)}
                onLongPress={onLongPressTab ? () => onLongPressTab(index) : undefined}
                onRemove={onRemoveActive}
              />
            </Animated.View>
          ))}
        </Animated.ScrollView>
      </LayoutAnimationConfig>
      <GlassIconButton systemImage="plus" label={addLabel} onPress={onAdd} />
    </View>
  );
}
