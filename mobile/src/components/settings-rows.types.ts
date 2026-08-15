import type { SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';

/**
 * Shared prop types for the settings-row vocabulary, kept in their own module so
 * `settings-rows.tsx` and `settings-rows.ios.tsx` are guaranteed to agree.
 */

export interface SettingsRowProps {
  label: string;
  /** The value side of the row. */
  children: ReactNode;
}

export interface SettingsToggleProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export interface SettingsPickerItem<T extends string> {
  label: string;
  value: T;
}

export interface SettingsPickerProps<T extends string> {
  label: string;
  selectedValue: T;
  onValueChange: (value: T) => void;
  items: SettingsPickerItem<T>[];
}

export interface SettingsSectionProps {
  title?: string;
  /**
   * Plain text, not a node: SwiftUI wants it wrapped in its own `Text` while
   * Compose wants a string, so each implementation supplies its own wrapper.
   */
  footer?: string;
  children: ReactNode;
}

export interface ValueTextProps {
  /**
   * Explicit color for values that carry meaning (P&L, server status).
   * Omitted, the text reads in the secondary/value color — iOS hierarchical
   * secondary, `mutedForeground` on Android.
   */
  color?: string;
  children: string;
}

export interface SettingsInputProps {
  label: string;
  placeholder?: string;
  /** Read once at mount — the field is uncontrolled; native state holds the text. */
  defaultValue?: string;
  /** Trailing unit label (a currency code) after the field. */
  suffix?: string;
  /**
   * Amount entry: decimal keyboard, and on iOS the worklet-filtered field that
   * rejects non-numeric characters before they draw (see numeric-field.tsx).
   */
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
