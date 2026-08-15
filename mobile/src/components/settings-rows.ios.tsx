import { LabeledContent, Picker, Section, Text as UIText, Toggle } from '@expo/ui/swift-ui';
import { monospacedDigit, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import type {
  SettingsPickerProps,
  SettingsRowProps,
  SettingsSectionProps,
  SettingsToggleProps,
} from './settings-rows.types';

/**
 * iOS settings-row vocabulary — the SwiftUI originals, kept exactly as the
 * screens wrote them before the Android port, so nothing about the shipping
 * iOS UI moves. See `settings-rows.tsx` for the cross-platform versions and
 * why the split exists.
 */

export function SettingsSection({ title, footer, children }: SettingsSectionProps) {
  return (
    <Section title={title} footer={footer ? <UIText>{footer}</UIText> : undefined}>
      {children}
    </Section>
  );
}

export type {
  SettingsPickerProps,
  SettingsRowProps,
  SettingsSectionProps,
  SettingsToggleProps,
} from './settings-rows.types';

export function SettingsRow({ label, children }: SettingsRowProps) {
  return <LabeledContent label={label}>{children}</LabeledContent>;
}

/** Value text with tabular figures, per DESIGN.md. */
export function NumericText({ children }: { children: string }) {
  return <UIText modifiers={[monospacedDigit()]}>{children}</UIText>;
}

export function SettingsToggle({ label, value, onValueChange }: SettingsToggleProps) {
  return <Toggle label={label} isOn={value} onIsOnChange={onValueChange} />;
}

export function SettingsPicker<T extends string>({
  label,
  selectedValue,
  onValueChange,
  items,
}: SettingsPickerProps<T>) {
  return (
    <Picker
      label={label}
      modifiers={[pickerStyle('menu')]}
      selection={selectedValue}
      onSelectionChange={(value) => onValueChange(value as T)}
    >
      {items.map((item) => (
        <UIText key={item.value} modifiers={[tag(item.value)]}>
          {item.label}
        </UIText>
      ))}
    </Picker>
  );
}
