import { useEffect, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
// react-native-pager-view, not @expo/ui's SwiftUI drop-in: the hosted-SwiftUI
// pager never wires RN's touch handler into its pages, so every Pressable and
// TextInput inside a page (chips, Add fill, the toggles, every amount field)
// silently ignored taps. Same imperative API, so the swap is the import.
import PagerView from 'react-native-pager-view';

import { SymbolPagerBar, type PagerTab } from '@/components/symbol-pager-bar';

// Plain style rather than a class: `PagerView` is a third-party native view,
// not one of the core components Uniwind extends with `className`.
const PAGER_STYLE = { flex: 1 } as const;

/**
 * A tab strip over a swipeable pager — the shape any form takes when it edits a
 * variable list of like things (the trade form's symbol blocks, the R
 * calculator's positions). The caller owns the list and the active index; this
 * owns the chrome and the motion between pages.
 */
export function SymbolPager({
  tabs,
  active,
  addLabel,
  removeLabel,
  keepLast,
  header,
  topStyle,
  onSelect,
  onLongPressTab,
  onAdd,
  onRemoveActive,
  renderPage,
}: {
  tabs: PagerTab[];
  /** Controlled: the page the form considers current. */
  active: number;
  addLabel: string;
  removeLabel: string;
  keepLast?: boolean;
  /** Rendered above the tab strip, inside the pinned area (e.g. an account row). */
  header?: ReactNode;
  /** Extra padding for the pinned area — a transparent nav bar to clear. */
  topStyle?: StyleProp<ViewStyle>;
  onSelect: (index: number) => void;
  onLongPressTab?: (index: number) => void;
  onAdd: () => void;
  onRemoveActive: () => void;
  renderPage: (index: number) => ReactNode;
}) {
  const pagerRef = useRef<PagerView>(null);
  const activeKey = tabs[active]?.key;

  // Tab taps / add / prefill drive `active`; swipes report back through
  // onPageSelected (re-asserting the page they landed on is a no-op).
  // Neighbours slide, so adding a page carries the form across instead of
  // cutting to it — the pager's own motion, which keeps content on screen the
  // whole way and needs no opacity (see the page comment below). Longer jumps
  // cut, because animating them smears through every page in between.
  const shownPage = useRef(active);
  const settle = (target: number) => {
    const pager = pagerRef.current;
    if (!pager) return;
    const previous = shownPage.current;
    shownPage.current = target;
    if (Math.abs(target - previous) === 1) pager.setPage(target);
    else pager.setPageWithoutAnimation(target);
  };

  // Appending a page can't move the pager in the same commit that mounts it:
  // the RN form inside is still rendering for a frame or two after the commit,
  // so scrolling straight away lands on an empty page and the form pops in
  // afterwards — the flash. So append first, let the page lay out, and only
  // then hand it to the pager, which is when `settle` sees a one-step move and
  // slides.
  const laidOut = useRef(new Set<string>());
  const pendingPage = useRef<number | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPending = () => {
    pendingPage.current = null;
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = null;
  };

  useEffect(() => {
    if (activeKey == null) return;
    if (laidOut.current.has(activeKey)) {
      clearPending();
      settle(active);
      return;
    }
    pendingPage.current = active;
    // Safety net: a page the pager keeps fully off-screen may never report
    // layout, and a page you can't reach is worse than a cut.
    pendingTimer.current = setTimeout(() => {
      if (pendingPage.current !== active) return;
      clearPending();
      settle(active);
    }, 160);
  }, [active, activeKey]);

  useEffect(() => () => clearPending(), []);

  return (
    <>
      <View className="gap-3 px-4 pb-2 pt-1" style={topStyle}>
        {header}
        <SymbolPagerBar
          tabs={tabs}
          active={active}
          addLabel={addLabel}
          removeLabel={removeLabel}
          keepLast={keepLast}
          onSelect={onSelect}
          onLongPressTab={onLongPressTab}
          onAdd={onAdd}
          onRemoveActive={onRemoveActive}
        />
      </View>
      <PagerView
        ref={pagerRef}
        style={PAGER_STYLE}
        initialPage={active}
        onPageSelected={(event) => onSelect(event.nativeEvent.position)}
      >
        {tabs.map((tab, index) => (
          // Plain View, never an opacity-animated one: these pages host
          // GlassView buttons, and iOS drops a visual-effect view's backdrop
          // for good once an ancestor's opacity leaves 1. Page motion has to
          // come from the pager itself.
          <View
            key={tab.key}
            className="flex-1"
            onLayout={() => {
              laidOut.current.add(tab.key);
              if (pendingPage.current !== index) return;
              clearPending();
              settle(index);
            }}
          >
            {renderPage(index)}
          </View>
        ))}
      </PagerView>
    </>
  );
}
