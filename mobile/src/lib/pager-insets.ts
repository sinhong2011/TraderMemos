import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** UIKit tab bar height in points, excluding the home-indicator inset below it. */
const IOS_TAB_BAR_HEIGHT = 49;

/**
 * Bottom clearance for scrollables nested inside react-native-pager-view.
 * UIKit's automatic contentInset adjustment reaches pager pages for the top
 * (nav bar) but never adds the floating tab bar at the bottom, so the last
 * card scrolls to a rest position underneath it. Pages pad explicitly with
 * this instead. Android's bottom bar is opaque and takes layout space, so no
 * clearance is needed there.
 */
export function usePagerBottomInset(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'ios' ? insets.bottom + IOS_TAB_BAR_HEIGHT : 0;
}
