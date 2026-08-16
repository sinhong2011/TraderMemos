import type { SFSymbol } from 'expo-symbols';
import { Select, Tabs, cn } from 'panelui-native';
import { Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';

export type SegmentedProps<T extends string> = {
  /** With `icon` set the segment shows only the SF Symbol; `label` stays for menus. */
  options: readonly { value: T; label: string; icon?: SFSymbol }[];
  value: T;
  onChange: (value: T) => void;
  /**
   * 'menu' renders a pull-down button instead of a segmented control; 'wheel'
   * a longer list for overlay pickers.
   */
  variant?: 'segmented' | 'menu' | 'wheel';
  /** Fixes a tight frame for nav bars instead of hugging content. */
  compact?: boolean;
  /** Stretches to the container width — form rows, where hugging leaves dead space. */
  fill?: boolean;
  /**
   * Cancels a menu trigger's own label padding so it lands on the same edge as
   * a plain value beside it. Was a SwiftUI menu inset; PanelUI's `Select`
   * trigger already sits on the frame's edge, so it is accepted and ignored.
   */
  flush?: boolean;
};

/**
 * The app's single-choice control, one file for both platforms.
 *
 * It used to be a SwiftUI `Picker` (`segmented.ios.tsx`) beside a hand-drawn
 * track, because `@expo/ui` had no segmented appearance to sit on. PanelUI
 * draws all three variants itself, so the split is gone and the 16 call sites
 * get the same control everywhere:
 *
 * - **segmented** is `Tabs` in its segmented variant — a raised chip travelling
 *   inside a recessed track. No panels: the tab strip *is* the control, and the
 *   value it reports is the caller's state.
 * - **menu** is a `Select` anchored to its trigger, which is what the SwiftUI
 *   pull-down was: a checkmarked list of one-of-N.
 * - **wheel** is the same `Select` presented from the bottom edge. There is no
 *   cross-platform drum, and the two wheel call sites (the calendar's
 *   month/year overlay) are choosing from a flat list either way — a sheet is
 *   the honest form of that on a phone.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  variant = 'segmented',
  compact,
  fill,
  flush: _flush,
}: SegmentedProps<T>) {
  // Segment glyphs are `expo-symbols` views, so they need the resolved token
  // rather than a class — and they have to re-resolve when the scheme flips.
  const [foreground, mutedForeground] = useCSSVariable([
    '--color-foreground',
    '--color-muted-foreground',
  ]) as [string, string];

  if (variant !== 'segmented') {
    return (
      <Select
        value={value}
        onValueChange={(next) => onChange(next as T)}
        // A pull-down floats over the page; a wheel's list is long enough that
        // the bottom sheet is the only place it fits without covering what it
        // is being chosen for.
        presentation={variant === 'wheel' ? 'sheet' : 'overlay'}
        className={cn(fill && 'self-stretch')}
      >
        {options.map((option) => (
          <Select.Item key={option.value} value={option.value} label={option.label} />
        ))}
      </Select>
    );
  }

  // Icons replace labels only when *every* segment has one — a half-glyphed
  // track reads as a rendering bug.
  const allIcons = options.every((option) => option.icon != null);

  return (
    <Tabs
      value={value}
      // `Tabs` insists on a starting value even when it is driven from outside.
      defaultValue={value}
      onValueChange={(next) => onChange(next as T)}
      className={cn(fill ? 'self-stretch' : 'self-start')}
    >
      {/* Hug mode is NOT Tabs' `scrollable`: that wraps the row in a
          horizontal ScrollView, and RN ScrollViews carry flexGrow:1 of their
          own — in a column with spare height the transparent scroller
          stretched into a giant empty slab (trade detail's interval
          switcher). A hugging segmented control never scrolls, so the row is
          laid out directly: flex-none triggers with the px-4 the scrollable
          variant would have supplied — a bare flex-none alone jams the
          labels together (30D90DALL). */}
      <Tabs.List className={cn('items-center', compact ? 'h-[30px] py-0' : 'h-10')}>
        {options.map((option) => (
          <Tabs.Trigger
            key={option.value}
            value={option.value}
            className={cn(
              !fill && 'flex-none px-4',
              // Compact drops the hug padding a step with the smaller label.
              compact && 'px-2.5 py-0.5',
            )}
          >
            {allIcons && option.icon ? (
              <View accessibilityLabel={option.label}>
                <Icon
                  name={option.icon}
                  size={compact ? 13 : 15}
                  tintColor={option.value === value ? foreground : mutedForeground}
                />
              </View>
            ) : compact ? (
              // The stock trigger label is a fixed size="sm" Text; compact
              // supplies its own so the whole control scales down together.
              <Text
                className={cn(
                  'text-[12px] font-medium',
                  option.value === value ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {option.label}
              </Text>
            ) : (
              option.label
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
