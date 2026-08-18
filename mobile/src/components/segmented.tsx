import type { SFSymbol } from 'expo-symbols';
import { BottomSheet, Item, Tabs, cn } from 'panelui-native';
import { Fragment, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';

export type SegmentedProps<T extends string> = {
  /**
   * With `icon` set on every option a segmented track shows only the SF
   * Symbols; a menu draws each option's icon as a leading badge in its sheet.
   */
  options: readonly { value: T; label: string; icon?: SFSymbol }[];
  value: T;
  onChange: (value: T) => void;
  /** Sheet heading for the menu variants — what the options are answering. */
  title?: string;
  /**
   * 'menu' renders a pull-down button instead of a segmented control; 'wheel'
   * a longer list for overlay pickers.
   */
  variant?: 'segmented' | 'menu' | 'wheel';
  /** Fixes a tight frame for nav bars instead of hugging content. */
  compact?: boolean;
  /**
   * Drops the track entirely — a row of plain text segments for spots where
   * even the recessed track is too much chrome (a card header). The selection
   * reads by weight and color instead of a travelling chip. On the menu
   * variants it shrinks the trigger to the same 11pt text, and when the
   * current value is not among this control's options the trigger collapses
   * to just the chevron — the overflow half of a split picker
   * (see interval-picker.tsx).
   */
  bare?: boolean;
  /**
   * Stretches to the container width — form rows, where hugging leaves dead
   * space. On the sheet-trigger variants this also parks the chevron on the
   * trailing edge (the FormPicker anatomy), so a field-shaped trigger reads
   * value-left, affordance-right.
   */
  fill?: boolean;
  /**
   * Cancels a menu trigger's own label padding so it lands on the same edge as
   * a plain value beside it — a trigger sitting on a row or shell edge, rather
   * than filling a pill of its own.
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
 * - **menu** and **wheel** are a pull-down — value + chevron, what the SwiftUI
 *   menu picker drew — opening a picker bottom sheet: a titled, checkmarked
 *   option list with leading icon badges when the options carry them. Composed
 *   on `BottomSheet` directly rather than `Menu`, whose radio rows reserve the
 *   icon slot for their own indicator and cap the design at bare labels. Not
 *   `Select` either: its bordered input-box trigger reads as a second control
 *   box inside rows and cards that already are one.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  title,
  variant = 'segmented',
  compact,
  bare,
  fill,
  flush,
}: SegmentedProps<T>) {
  const [open, setOpen] = useState(false);
  // Segment glyphs are `expo-symbols` views, so they need the resolved token
  // rather than a class — and they have to re-resolve when the scheme flips.
  const [foreground, mutedForeground, primary] = useCSSVariable([
    '--color-foreground',
    '--color-muted-foreground',
    '--color-primary',
  ]) as [string, string, string];

  if (variant !== 'segmented') {
    const selected = options.find((option) => option.value === value);
    const hasIcons = options.some((option) => option.icon != null);
    return (
      <BottomSheet
        open={open}
        // Opening from a focused field must take the keyboard down with it —
        // a decimal pad has no return key, so this tap is its only dismissal.
        onOpenChange={(next) => {
          if (next) Keyboard.dismiss();
          setOpen(next);
        }}
      >
        <BottomSheet.Trigger>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={selected?.label ?? title}
            hitSlop={6}
            className={cn(
              'flex-row items-center active:opacity-60',
              bare ? 'gap-0.5 px-1.5 py-1' : 'gap-1.5',
              // The default padding is what fills a `ControlPill`; flush
              // triggers sit on an edge a row already owns.
              !flush && !bare && 'px-3 py-1.5',
              fill && 'flex-1 justify-between self-stretch',
            )}
          >
            {bare && !selected ? null : (
              <Text
                className={cn(
                  'font-medium text-foreground',
                  bare ? 'text-[11px] font-semibold' : compact ? 'text-[13px]' : 'text-[15px]',
                )}
                numberOfLines={1}
              >
                {selected?.label ?? ''}
              </Text>
            )}
            <Icon name="chevron.up.chevron.down" size={11} tintColor={mutedForeground} />
          </Pressable>
        </BottomSheet.Trigger>
        <BottomSheet.Content>
          {title ? <BottomSheet.Header title={title} /> : null}
          {/* Not `BottomSheet.Body`: it is a flex-1 scroller that needs a
              fixed-height sheet above it, and this sheet sizes to its options
              — Body collapses to nothing there. A capped ScrollView keeps the
              short lists at their natural height and lets a long one (the
              calendar's years) scroll inside the cap. */}
          <ScrollView className="max-h-[440px]" bounces={false}>
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <Fragment key={option.value}>
                  {index > 0 ? (
                    // Inset past the icon badge so the hairline underlines the
                    // labels, the grouped-list rule the form rows follow.
                    <Item.Separator className={cn(hasIcons && 'ml-[42px]')} />
                  ) : null}
                  <Pressable
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    // Press feedback dims the row (the app's pressable idiom) —
                    // a filled accent slab bled across the sheet read as a
                    // mispainted band.
                    className="min-h-[52px] flex-row items-center gap-3 active:opacity-60"
                  >
                    {option.icon ? (
                      <View
                        className="h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-fill"
                        style={{ borderCurve: 'continuous' }}
                      >
                        <Icon name={option.icon} size={15} tintColor={foreground} />
                      </View>
                    ) : null}
                    <Text
                      className={cn(
                        'flex-1 text-[17px] text-foreground',
                        isSelected && 'font-semibold',
                      )}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                    {/* Only the chosen row carries a mark — a hollow circle on
                        every other row would read as five decisions instead of
                        one made. */}
                    {isSelected ? (
                      <Icon name="checkmark.circle.fill" size={22} tintColor={primary} />
                    ) : null}
                  </Pressable>
                </Fragment>
              );
            })}
          </ScrollView>
        </BottomSheet.Content>
      </BottomSheet>
    );
  }

  // Trackless: each option is a small text button, the selected one lifted to
  // full foreground weight. Labels only — a bare glyph row would read as
  // stray icons, not a choice.
  if (bare) {
    return (
      <View className="flex-row items-center">
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              className="px-1.5 py-1 active:opacity-60"
            >
              <Text
                className={cn(
                  'text-[11px]',
                  isSelected ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
                )}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
      {/* bg-segment-track replaces the stock bg-muted, which in dark resolves
          to the same grey as the bg-popover chip — see global.css. */}
      <Tabs.List
        className={cn('items-center bg-segment-track', compact ? 'h-[30px] py-0' : 'h-10')}
      >
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
