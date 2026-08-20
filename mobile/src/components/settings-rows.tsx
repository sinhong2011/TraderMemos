import type { SFSymbol } from 'expo-symbols';
import { BottomSheet, cn, Frame, Item, Switch, Text } from 'panelui-native';
import { Fragment, useState, type ReactNode } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';

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
 * The whole row is the trigger and the options arrive in a bottom sheet with
 * the Segmented picker sheet's row anatomy — 52pt rows, hairline separators,
 * the chosen row bold with a trailing check — so every option list in the app
 * reads as one component. (`Menu.RadioItem`'s sheet presentation drew tall,
 * dividerless rows with a leading check gutter — a different, sparser list.)
 */
export function SettingsPicker<T extends string>({
  systemImage,
  label,
  selectedValue,
  onValueChange,
  items,
}: SettingsPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [mutedForeground, primary] = useCSSVariable([
    '--color-muted-foreground',
    '--color-primary',
  ]) as [string, string];
  const selected = items.find((item) => item.value === selectedValue);

  return (
    <>
      <Frame.Row
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
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
      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheet.Content>
          <BottomSheet.Header title={label} />
          {/* Capped ScrollView, not BottomSheet.Body — Body is a flex-1
              scroller that collapses in a sheet sized to its options (the
              Segmented picker sheet's reasoning). */}
          <ScrollView className="max-h-[440px]" bounces={false}>
            {items.map((item, index) => {
              const isSelected = item.value === selectedValue;
              return (
                <Fragment key={item.value}>
                  {index > 0 ? <Item.Separator /> : null}
                  <Pressable
                    onPress={() => {
                      onValueChange(item.value);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    className="min-h-[52px] flex-row items-center gap-3 active:opacity-60"
                  >
                    <Text className={cn('flex-1 text-[17px]', isSelected && 'font-semibold')}>
                      {item.label}
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
    </>
  );
}
