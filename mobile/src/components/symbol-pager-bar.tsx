import { Chip, cn } from 'panelui-native';
import { Text, View } from 'react-native';
import Animated, {
  interpolate,
  LayoutAnimationConfig,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GlassIconButton } from '@/components/glass-button';

/** The app's one spring (see form-rows.tsx) — strip motion matches the fills. */
const TAB_SPRING = { duration: 420, dampingRatio: 0.85 } as const;

/**
 * Critically damped, unlike `TAB_SPRING`: a slot closing to zero must not
 * overshoot — 0.85 damping swings the width negative and back, which on
 * screen reads as the strip closing, reopening a sliver, then closing again.
 * The opening spring keeps its bounce; over-opening is a positive width.
 */
const COLLAPSE_SPRING = { duration: 300, dampingRatio: 1 } as const;

/**
 * Entering tabs grow open from zero width on the strip's spring while they
 * fade in. This is deliberately *not* a `LinearTransition` on the track or its
 * children: animating the one tab's width lets the neighbours, the capsule and
 * the "+" follow through ordinary layout every frame, which is what keeps the
 * strip fluid — a layout transition on the ScrollView itself stutters on iOS.
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

export type PagerTab = {
  key: string;
  label: string;
  /** Never offers the inline clear glyph — a page the form always owns (the
   * daily log's own recap sits at index 0 alongside its symbol pages). */
  fixed?: boolean;
};

/**
 * One tab. Removal is collapse-then-unmount: a Reanimated `exiting` animation
 * never fires for these views (inside the strip's horizontal ScrollView the
 * removed tab simply vanished, on both platforms), so the ✕ does not unmount
 * anything — it springs the slot's width to zero itself, neighbours and the
 * "+" following through ordinary layout each frame, and only the finished
 * animation reports the removal upward. The mirror of `tabEnter`, so add and
 * remove read as the same liquid motion.
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
  /** Natural slot width, kept fresh while the tab is open. */
  const measured = useSharedValue(0);
  /** 1 open → 0 collapsed. Only read once `closing` flips. */
  const progress = useSharedValue(1);
  const closing = useSharedValue(false);

  const collapse = useAnimatedStyle(() => {
    if (!closing.value) return {};
    return {
      width: Math.max(0, measured.value * progress.value),
      // Gone well before the width lands, so the ghost never sits on top of
      // the neighbour sliding underneath it.
      opacity: interpolate(progress.value, [0.6, 1], [0, 1], 'clamp'),
      transform: [{ scale: 0.9 + progress.value * 0.1 }],
    };
  });

  const startRemove = () => {
    if (closing.value) return;
    // eslint-disable-next-line react-hooks/immutability -- reanimated shared value
    closing.value = true;
    // eslint-disable-next-line react-hooks/immutability -- reanimated shared value
    progress.value = withSpring(0, COLLAPSE_SPRING, (finished) => {
      'worklet';
      if (finished) runOnJS(onRemove)();
    });
  };

  return (
    // Clips the label while the collapse squeezes the slot shut.
    <Animated.View
      className="overflow-hidden"
      entering={tabEnter}
      style={collapse}
      onLayout={(event) => {
        // A closing slot reports its own shrinking width — not a measurement.
        if (closing.value) return;
        // eslint-disable-next-line react-hooks/immutability -- reanimated shared value
        measured.value = event.nativeEvent.layout.width;
      }}
    >
      <Chip
        onPress={onPress}
        onLongPress={onLongPress}
        onClose={removable ? startRemove : undefined}
        closeLabel={removeLabel}
        // A page switcher, not a filter: announced as a tab set, so the chip's
        // own toggle semantics stay off (`selected` unset) and the active
        // state is drawn by class instead.
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        className={cn(
          // 34 + 3pt of capsule padding either side lines the strip up with
          // the 40pt glass "+" button beside it.
          'min-h-[34px] min-w-[44px] justify-center rounded-full border-0 bg-transparent px-3',
          isActive && 'bg-segment-active',
        )}
      >
        {/* Own Text rather than `Chip.Label`: the label component cannot
            truncate, and a runaway page name has to ellipsize inside the
            capsule, not wrap it open. */}
        <Text
          className={cn(
            'max-w-[140px] text-[13px]',
            isActive ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
          )}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Chip>
    </Animated.View>
  );
}

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
 * Tabs are PanelUI `Chip`s (the token shape: pressable pill, own-hit-target ✕
 * via `onClose`), restyled to sit borderless inside the capsule track so the
 * strip stays in the segmented family. Not `Tabs`: a fixed segmented set has
 * no per-tab remove or append, which is this strip's whole job. What looked
 * like the strip being broken on Android was the native glass "+" swallowing
 * presses (see glass-button.tsx) — the width-spring animations run fine there.
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
      {/* `tabEnter` describes a tab being *added* — it opens from zero width.
          On mount there is nothing being added, so `skipEntering` suppresses
          it for the tabs already present when the bar appears. */}
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
        >
          {tabs.map((tab, index) => (
            <SymbolTab
              key={tab.key}
              label={tab.label}
              isActive={index === active}
              // Only the active tab offers its clear glyph — the iOS
              // token-field idiom, and what keeps a long strip from growing a
              // row of ✕s.
              removable={index === active && removable && !tab.fixed}
              removeLabel={removeLabel}
              onPress={() => onSelect(index)}
              onLongPress={onLongPressTab ? () => onLongPressTab(index) : undefined}
              onRemove={onRemoveActive}
            />
          ))}
        </Animated.ScrollView>
      </LayoutAnimationConfig>
      {/* Pinned to the row's trailing edge, not to the capsule: a fixed home
          means the "+" never shifts as tabs come and go, and the thumb always
          finds it in the same place. */}
      <View className="ml-auto">
        <GlassIconButton systemImage="plus" label={addLabel} onPress={onAdd} />
      </View>
    </View>
  );
}
