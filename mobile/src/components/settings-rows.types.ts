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

export interface SettingsButtonProps {
  label: string;
  /** Leading SF Symbol; Android maps it through `@/lib/sf-to-material`. */
  systemImage?: SFSymbol;
  /** `destructive` tints the row red, for rows that remove something. */
  role?: 'default' | 'destructive';
  disabled?: boolean;
  onPress: () => void;
}
