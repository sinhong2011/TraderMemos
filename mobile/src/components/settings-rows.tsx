import type { SFSymbol } from 'expo-symbols';
import { cn, Frame, Input, Menu, Switch, Text } from 'panelui-native';
import { useState, type ReactNode } from 'react';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { numericText } from '@/lib/amount';

/**
 * The settings-row vocabulary — one implementation for both platforms, drawn
 * in JS on PanelUI's `Frame`.
 *
 * A section is a `Frame` (title strip, card panel, footer caption) and every
 * row is a `Frame.Row` inside its `Frame.Panel`, which is where the shared
 * row metrics, the press highlight and the leading/content/trailing slot rules
 * come from. The old SwiftUI `Form`/`Section`/`LabeledContent` set and its
 * Compose counterpart are both gone, and with them the platform split — the
 * settings screens see exactly the same components and the same props they
 * always did.
 */

export interface SettingsRowProps {
  /** Leading SF Symbol; Android maps it through `@/lib/sf-to-material`. */
  systemImage?: SFSymbol;
  label: string;
  /** The value side of the row. */
  children: ReactNode;
}

export interface SettingsToggleProps {
  /** Leading SF Symbol; Android maps it through `@/lib/sf-to-material`. */
  systemImage?: SFSymbol;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export interface SettingsPickerItem<T extends string> {
  label: string;
  value: T;
}

export interface SettingsPickerProps<T extends string> {
  /** Leading SF Symbol; Android maps it through `@/lib/sf-to-material`. */
  systemImage?: SFSymbol;
  label: string;
  selectedValue: T;
  onValueChange: (value: T) => void;
  items: SettingsPickerItem<T>[];
}

export interface SettingsSectionProps {
  title?: string;
  /** Plain text caption under the section's card. */
  footer?: string;
  children: ReactNode;
}

export interface ValueTextProps {
  /**
   * Explicit color for values that carry meaning (P&L, server status). Omitted,
   * the text reads in `muted-foreground`, so rows read label-dark /
   * value-muted the way a grouped list does.
   */
  color?: string;
  children: string;
}

export interface SettingsInputProps {
  label: string;
  placeholder?: string;
  /** Seeds the field at mount; the row owns the text from then on. */
  defaultValue?: string;
  /** Trailing unit label (a currency code) after the field. */
  suffix?: string;
  /** Amount entry: decimal keyboard, and non-numeric characters filtered out. */
  numeric?: boolean;
  onChangeText: (text: string) => void;
}

export interface SettingsButtonProps {
  label: string;
  /** Leading SF Symbol; Android maps it through `@/lib/sf-to-material`. */
  systemImage?: SFSymbol;
  /** `destructive` tints the row red, for rows that remove something. */
  role?: 'default' | 'destructive';
  disabled?: boolean;
  onPress: () => void;
}

/** Grouped section: an optional title, a card of rows, an optional footer. */
export function SettingsSection({ title, footer, children }: SettingsSectionProps) {
  return (
    // `plain` because the title and footer sit *outside* the card here, the way
    // a grouped list writes them — the default variant's tray would draw a
    // second edge around a panel that already has one.
    <Frame variant="plain">
      {title ? (
        <Frame.Header className="px-4 pb-1.5 pt-0">
          <Frame.Title className="text-xs uppercase tracking-wider">{title}</Frame.Title>
        </Frame.Header>
      ) : null}
      {/* Borderless per DESIGN.md: the card is `bg-card` elevation alone — no
          box border, no hairlines between rows. Row padding and the press
          highlight do the separating. */}
      <Frame.Panel dividers={false} className="rounded-3xl border-0">
        {children}
      </Frame.Panel>
      {footer ? (
        <Text size="xs" muted className="px-4 pt-2">
          {footer}
        </Text>
      ) : null}
    </Frame>
  );
}

/**
 * Leading icon slot shared by the rows below — NavRow's treatment exactly
 * (17pt, neutral foreground), so labels land on one vertical line whichever
 * row kind a section mixes.
 */
function RowIcon({ name }: { name: SFSymbol }) {
  const [foreground] = useCSSVariable(['--color-foreground']) as [string];
  return (
    <Frame.Media>
      <Icon name={name} size={17} tintColor={foreground} />
    </Frame.Media>
  );
}

/** A label paired with a read-only value. */
export function SettingsRow({ systemImage, label, children }: SettingsRowProps) {
  return (
    <Frame.Row>
      {systemImage != null ? <RowIcon name={systemImage} /> : null}
      <Frame.Content>
        <Frame.Title>{label}</Frame.Title>
      </Frame.Content>
      {/* `shrink` against the slot's own `shrink-0`: a long value (a server
          URL) wraps inside the row instead of running off the card. */}
      <Frame.Actions className="min-w-0 shrink justify-end">{children}</Frame.Actions>
    </Frame.Row>
  );
}

/** An action row: leading icon, tinted label, no navigation affordance. */
export function SettingsButton({
  label,
  systemImage,
  role = 'default',
  disabled,
  onPress,
}: SettingsButtonProps) {
  const [primary, destructive] = useCSSVariable([
    '--color-primary',
    '--color-destructive',
  ]) as [string, string];
  const tint = role === 'destructive' ? destructive : primary;

  return (
    <Frame.Row
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      className={cn(disabled && 'opacity-40')}
    >
      {systemImage != null ? (
        <Frame.Media>
          <Icon name={systemImage} size={17} tintColor={tint} />
        </Frame.Media>
      ) : null}
      <Frame.Content>
        <Frame.Title className={role === 'destructive' ? 'text-destructive' : 'text-primary'}>
          {label}
        </Frame.Title>
      </Frame.Content>
    </Frame.Row>
  );
}

/** Value text with tabular figures, per DESIGN.md. */
export function NumericText({ children }: { children: string }) {
  return <Text size="sm" className="tabular-nums">{children}</Text>;
}

/**
 * Value-side text. Colored when the value carries meaning (P&L, status);
 * otherwise the muted value color.
 */
export function ValueText({ color, children }: ValueTextProps) {
  return (
    <Text size="sm" muted={color == null} style={color != null ? { color } : undefined}>
      {children}
    </Text>
  );
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
  // The field is drawn in JS now, so a rejected character can be filtered in
  // the same commit that produced it — no worklet, and no letter that appears
  // and vanishes the way an uncontrolled RN field used to give.
  const [value, setValue] = useState(defaultValue ?? '');

  function handleChange(next: string) {
    const cleaned = numeric ? numericText(next) : next;
    setValue(cleaned);
    onChangeText(cleaned);
  }

  return (
    <Frame.Row>
      <Frame.Content>
        <Frame.Title>{label}</Frame.Title>
      </Frame.Content>
      <Frame.Actions className="min-w-0 shrink grow justify-end gap-2">
        <Input
          variant="filled"
          size="sm"
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          keyboardType={numeric ? 'decimal-pad' : 'default'}
          autoCorrect={!numeric}
          accessibilityLabel={label}
          className="text-right"
          containerClassName="w-auto min-w-0 shrink grow"
        />
        {suffix != null ? (
          <Text size="sm" muted>
            {suffix}
          </Text>
        ) : null}
      </Frame.Actions>
    </Frame.Row>
  );
}

/** A labelled on/off row. */
export function SettingsToggle({ systemImage, label, value, onValueChange }: SettingsToggleProps) {
  return (
    <Frame.Row>
      {systemImage != null ? <RowIcon name={systemImage} /> : null}
      <Frame.Content>
        <Frame.Title>{label}</Frame.Title>
      </Frame.Content>
      <Frame.Actions>
        <Switch value={value} onValueChange={onValueChange} accessibilityLabel={label} />
      </Frame.Actions>
    </Frame.Row>
  );
}

/**
 * A labelled single-choice row.
 *
 * The whole row is the trigger and the options arrive in a `Menu` — the
 * pull-down shape SwiftUI's `pickerStyle('menu')` gave the row before, rather
 * than `Select`'s bordered trigger, which would put a second control box
 * inside a card that is already one.
 */
export function SettingsPicker<T extends string>({
  systemImage,
  label,
  selectedValue,
  onValueChange,
  items,
}: SettingsPickerProps<T>) {
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  const selected = items.find((item) => item.value === selectedValue);

  return (
    <Menu presentation="bottom-sheet">
      <Menu.Trigger>
        <Frame.Row accessibilityRole="button" accessibilityLabel={label}>
          {systemImage != null ? <RowIcon name={systemImage} /> : null}
          <Frame.Content>
            <Frame.Title>{label}</Frame.Title>
          </Frame.Content>
          <Frame.Actions>
            {selected ? (
              <Text size="sm" muted>
                {selected.label}
              </Text>
            ) : null}
            <Icon name="chevron.up.chevron.down" size={11} tintColor={mutedForeground} />
          </Frame.Actions>
        </Frame.Row>
      </Menu.Trigger>
      <Menu.Content width="full" className="shadow-none rounded-none">
        <Menu.RadioGroup
          value={selectedValue}
          onValueChange={(value) => onValueChange(value as T)}
        >
          {items.map((item) => (
            <Menu.RadioItem key={item.value} value={item.value}>
              {item.label}
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu>
  );
}
