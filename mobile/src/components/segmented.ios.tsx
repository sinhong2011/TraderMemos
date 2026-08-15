import {
  Image as UIImage,
  Picker,
  Text as UIText,
} from '@expo/ui/swift-ui';
import { padding, pickerStyle, tag, tint } from '@expo/ui/swift-ui/modifiers';
import { useUnistyles } from 'react-native-unistyles';
import { AppHost } from '@/components/app-host';

import type { SegmentedProps } from './segmented.types';

/** SwiftUI's own inset around a menu Picker's label — see `flush` below. */
const MENU_LABEL_PADDING = 12;

/** Native SwiftUI Picker — segmented control on cards, a pull-down menu, or a wheel. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  variant = 'segmented',
  compact,
  fill,
  flush,
}: SegmentedProps<T>) {
  const { theme } = useUnistyles();
  // Menu triggers render in the accent color by default — keep the
  // label neutral (primary is fill-only).
  // A `tint` here would not reach a segmented picker's selection — SwiftUI
  // paints that itself. Color-coded toggles use `ValueToggle` instead.
  const modifiers = [
    pickerStyle(variant),
    ...(variant === 'menu' ? [tint(theme.colors.foreground)] : []),
    // A menu Picker reserves ~12pt around its label, so beside a plain value
    // (a static name, a date pill) it reads as if it were indented. `flush`
    // takes that back so the label sits on the frame's edge either way.
    ...(flush && variant === 'menu' ? [padding({ horizontal: -MENU_LABEL_PADDING })] : []),
  ];
  const allIcons = options.every((option) => option.icon != null);
  return (
    // Wheels have no useful intrinsic width — let the parent's flexbox size
    // them; compact fixes a tight frame (icon segments pack much narrower than
    // text ones); everything else hugs its content.
    <AppHost
      {...(variant === 'wheel'
        ? { style: { flex: 1, height: 190 } }
        : compact
          ? { style: { width: allIcons ? 140 : 185, height: 30 } }
          : fill
            ? { style: { alignSelf: 'stretch', height: 34 } }
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
    </AppHost>
  );
}
