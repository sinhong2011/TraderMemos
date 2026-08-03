import { Host, Image as UIImage, Picker, Text as UIText } from '@expo/ui/swift-ui';
import { pickerStyle, tag, tint } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'expo-symbols';
import { useUnistyles } from 'react-native-unistyles';

type SegmentedProps<T extends string> = {
  /** With `icon` set the segment shows only the SF Symbol; `label` stays for menus. */
  options: readonly { value: T; label: string; icon?: SFSymbol }[];
  value: T;
  onChange: (value: T) => void;
  /**
   * 'menu' renders a pull-down button (checkmarked UIMenu) instead of a
   * segmented control; 'wheel' a spinning drum for overlay pickers.
   */
  variant?: 'segmented' | 'menu' | 'wheel';
  /** Fixes a tight frame for nav bars instead of hugging content. */
  compact?: boolean;
};

/** Native SwiftUI Picker — segmented control on cards, a pull-down menu, or a wheel. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  variant = 'segmented',
  compact,
}: SegmentedProps<T>) {
  const { theme } = useUnistyles();
  // Menu triggers render in the accent color by default — keep the
  // label neutral (primary is fill-only).
  // A `tint` here would not reach a segmented picker's selection — SwiftUI
  // paints that itself. Color-coded toggles use `ValueToggle` instead.
  const modifiers = [
    pickerStyle(variant),
    ...(variant === 'menu' ? [tint(theme.colors.foreground)] : []),
  ];
  const allIcons = options.every((option) => option.icon != null);
  return (
    // Wheels have no useful intrinsic width — let the parent's flexbox size
    // them; compact fixes a tight frame (icon segments pack much narrower than
    // text ones); everything else hugs its content.
    <Host
      {...(variant === 'wheel'
        ? { style: { flex: 1, height: 190 } }
        : compact
          ? { style: { width: allIcons ? 140 : 185, height: 30 } }
          : { matchContents: true })}
    >
      <Picker
        selection={value}
        onSelectionChange={(selection) => {
          if (selection != null) onChange(selection);
        }}
        modifiers={modifiers}
      >
        {options.map((option) =>
          option.icon && variant !== 'menu' ? (
            <UIImage key={option.value} systemName={option.icon} modifiers={[tag(option.value)]} />
          ) : (
            <UIText key={option.value} modifiers={[tag(option.value)]}>
              {option.label}
            </UIText>
          ),
        )}
      </Picker>
    </Host>
  );
}
