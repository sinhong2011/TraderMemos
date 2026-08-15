import { FieldGroup, ListItem, Picker, RNHostView, Switch, Text, TextInput } from '@expo/ui';
import { Pressable, Text as RNText } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';

import type {
  SettingsButtonProps,
  SettingsInputProps,
  SettingsPickerProps,
  SettingsRowProps,
  SettingsSectionProps,
  SettingsToggleProps,
  ValueTextProps,
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
 * An action row: leading icon, label, no navigation affordance.
 *
 * Universal `Button` is deliberately not used here. It has no `systemImage`
 * prop and defaults to `variant='filled'`, which maps to `borderedProminent`
 * on iOS — a settings list full of solid blue buttons with the icons dropped.
 * So this follows `nav-row.tsx`: RN inside an `RNHostView`, reusing the mapped
 * icon layer.
 */
export function SettingsButton({
  label,
  systemImage,
  role = 'default',
  disabled,
  onPress,
}: SettingsButtonProps) {
  const { theme } = useUnistyles();
  const tint = role === 'destructive' ? theme.colors.destructive : theme.colors.primary;

  return (
    <RNHostView matchContents>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        style={({ pressed }) => [
          buttonStyles.row,
          pressed && buttonStyles.pressed,
          disabled && buttonStyles.disabled,
        ]}
      >
        {systemImage != null ? <Icon name={systemImage} size={17} tintColor={tint} /> : null}
        <RNText style={[buttonStyles.label, { color: tint }]}>{label}</RNText>
      </Pressable>
    </RNHostView>
  );
}

const buttonStyles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  pressed: { backgroundColor: theme.colors.accent },
  disabled: { opacity: 0.4 },
  label: { fontSize: 17 },
}));

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

/**
 * Value-side text. Colored when the value carries meaning (P&L, status);
 * otherwise the secondary value color, so rows read label-dark / value-muted
 * the way iOS grouped lists do.
 */
export function ValueText({ color, children }: ValueTextProps) {
  const { theme } = useUnistyles();
  return <Text textStyle={{ color: color ?? theme.colors.mutedForeground }}>{children}</Text>;
}

/** A label paired with an inline, trailing-aligned text field. */
export function SettingsInput({
  label,
  placeholder,
  defaultValue,
  suffix,
  numeric,
  onChangeText,
}: SettingsInputProps) {
  const { theme } = useUnistyles();
  return (
    <ListItem>
      <Text>{label}</Text>
      <ListItem.Trailing>
        {/* Uncontrolled — native state holds the text, `onChangeText` mirrors
            it into a ref for submit-time reads (the account-form pattern).
            No worklet filter here: Android validates amounts at submit, the
            decimal keyboard keeps the input honest enough. */}
        <TextInput
          defaultValue={defaultValue}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.mutedForeground}
          textAlign="right"
          keyboardType={numeric ? 'decimal-pad' : 'default'}
          autoCorrect={!numeric}
          onChangeText={onChangeText}
        />
        {suffix != null ? <Text textStyle={{ color: theme.colors.mutedForeground }}>{suffix}</Text> : null}
      </ListItem.Trailing>
    </ListItem>
  );
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
