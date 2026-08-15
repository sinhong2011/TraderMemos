import {
  Button,
  HStack,
  LabeledContent,
  Picker,
  Section,
  Text as UIText,
  TextField,
  Toggle,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  disabled as disabledModifier,
  foregroundStyle,
  keyboardType as keyboardTypeModifier,
  monospacedDigit,
  multilineTextAlignment,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';

import { useNumericState } from '@/components/numeric-field';

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

/** An action row: leading icon, label, no navigation affordance. */
export function SettingsButton({
  label,
  systemImage,
  role = 'default',
  disabled,
  onPress,
}: SettingsButtonProps) {
  return (
    <Button
      label={label}
      systemImage={systemImage}
      role={role}
      onPress={onPress}
      modifiers={disabled ? [disabledModifier(true)] : []}
    />
  );
}

/** Value text with tabular figures, per DESIGN.md. */
export function NumericText({ children }: { children: string }) {
  return <UIText modifiers={[monospacedDigit()]}>{children}</UIText>;
}

/** Value-side text — hierarchical secondary unless a meaning color is given. */
export function ValueText({ color, children }: ValueTextProps) {
  return (
    <UIText
      modifiers={[
        foregroundStyle(color ?? { type: 'hierarchical', style: 'secondary' as const }),
      ]}
    >
      {children}
    </UIText>
  );
}

/**
 * A label paired with an inline, trailing-aligned text field — the
 * account-form idiom: uncontrolled SwiftUI text state drives the field,
 * `onChangeText` mirrors keystrokes for submit-time ref reads. `numeric`
 * swaps in the worklet-filtered state (see numeric-field.tsx). The trailing
 * alignment is stated because SwiftUI otherwise leaves text against the
 * label while trailing `Picker` selections, breaking the value column.
 */
export function SettingsInput(props: SettingsInputProps) {
  // Split so each variant owns its hook — `numeric` never changes at a call
  // site, but the rules of hooks are static.
  return props.numeric ? <NumericInput {...props} /> : <TextInputRow {...props} />;
}

function TextInputRow({ label, placeholder, defaultValue, suffix, onChangeText }: SettingsInputProps) {
  const state = useNativeState(defaultValue ?? '');
  return (
    <LabeledContent label={label}>
      <HStack spacing={8}>
        <TextField
          placeholder={placeholder}
          text={state}
          onTextChange={onChangeText}
          modifiers={[multilineTextAlignment('trailing')]}
        />
        {suffix != null ? <ValueText>{suffix}</ValueText> : null}
      </HStack>
    </LabeledContent>
  );
}

function NumericInput({ label, placeholder, defaultValue, suffix, onChangeText }: SettingsInputProps) {
  const state = useNumericState(defaultValue ?? '');
  return (
    <LabeledContent label={label}>
      <HStack spacing={8}>
        <TextField
          placeholder={placeholder}
          text={state}
          onTextChange={onChangeText}
          modifiers={[keyboardTypeModifier('decimal-pad'), multilineTextAlignment('trailing')]}
        />
        {suffix != null ? <ValueText>{suffix}</ValueText> : null}
      </HStack>
    </LabeledContent>
  );
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
