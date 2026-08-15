import { FieldGroup, ListItem, Picker, Switch, Text } from '@expo/ui';

import type {
  SettingsPickerProps,
  SettingsRowProps,
  SettingsSectionProps,
  SettingsToggleProps,
} from './settings-rows.types';

/**
 * The settings-row vocabulary, in its cross-platform form. `settings-rows.ios.tsx`
 * overrides this with the SwiftUI originals; both export the same names, so the
 * settings screens never branch. (As with `settings-form`, the universal file
 * must be the unsuffixed one — TypeScript only resolves the base name.)
 *
 * These exist because the universal primitives don't cover the app's row shapes
 * one-for-one:
 *
 * - `@expo/ui`'s `Picker` has **no `label` prop**, while SwiftUI's does and every
 *   settings row depends on it for the row title. Dropping in the universal
 *   Picker directly would silently erase the label on every picker row, so
 *   `SettingsPicker` supplies it — as a `ListItem` headline here, and as the
 *   SwiftUI `Picker`'s own label on iOS.
 * - `LabeledContent` has no universal counterpart at all; `SettingsRow` rebuilds
 *   it from `ListItem` (headline = label, trailing = value).
 *
 * `SettingsToggle` needs no such help — universal `Switch` already takes a label
 * and compiles to the very same SwiftUI `Toggle` on iOS.
 */

/** Grouped section with an optional title and footer. */
export function SettingsSection({ title, footer, children }: SettingsSectionProps) {
  return (
    <FieldGroup.Section title={title}>
      {children}
      {footer ? (
        <FieldGroup.SectionFooter>
          <Text>{footer}</Text>
        </FieldGroup.SectionFooter>
      ) : null}
    </FieldGroup.Section>
  );
}

/** A label paired with a read-only value — the `LabeledContent` stand-in. */
export function SettingsRow({ label, children }: SettingsRowProps) {
  return (
    <ListItem>
      <Text>{label}</Text>
      <ListItem.Trailing>{children}</ListItem.Trailing>
    </ListItem>
  );
}

/**
 * Value text with tabular figures, per DESIGN.md.
 *
 * Known gap: `@expo/ui`'s universal `Text` exposes no tabular-numbers option and
 * Compose has no equivalent knob reachable from here, so on Android these read
 * in the default proportional figures. iOS keeps `monospacedDigit()` via
 * `settings-rows.ios.tsx`. Worth revisiting once a real device shows how badly
 * the preview column shifts.
 */
export function NumericText({ children }: { children: string }) {
  return <Text>{children}</Text>;
}

/** A labelled on/off row. */
export function SettingsToggle({ label, value, onValueChange }: SettingsToggleProps) {
  return <Switch label={label} value={value} onValueChange={onValueChange} />;
}

/** A labelled single-choice row. */
export function SettingsPicker<T extends string>({
  label,
  selectedValue,
  onValueChange,
  items,
}: SettingsPickerProps<T>) {
  return (
    <ListItem>
      <Text>{label}</Text>
      <ListItem.Trailing>
        <Picker selectedValue={selectedValue} onValueChange={(v) => onValueChange(v as T)}>
          {items.map((item) => (
            <Picker.Item key={item.value} label={item.label} value={item.value} />
          ))}
        </Picker>
      </ListItem.Trailing>
    </ListItem>
  );
}
