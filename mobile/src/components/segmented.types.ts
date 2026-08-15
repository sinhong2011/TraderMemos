import type { SFSymbol } from 'expo-symbols';

/** Shared by `segmented.tsx` (cross-platform) and `segmented.ios.tsx` (SwiftUI). */
export type SegmentedProps<T extends string> = {
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
  /** Stretches to the container width — form rows, where hugging leaves dead space. */
  fill?: boolean;
  /**
   * Cancels the menu's own label padding so it lands on the same edge as a
   * plain value beside it (form rows, boxed fields). Menu variant only.
   */
  flush?: boolean;
};
