import type { SFSymbol } from 'expo-symbols';

/** Shared by `glass-button.tsx` (cross-platform) and `glass-button.ios.tsx` (SwiftUI). */
export type GlassButtonProps = {
  label: string;
  systemImage?: SFSymbol;
  prominent?: boolean;
  /** Stretch to the container width — form actions, not inline chrome. */
  fill?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export type GlassIconButtonProps = {
  systemImage: SFSymbol;
  /** Accessibility label — the button shows only the symbol. */
  label: string;
  disabled?: boolean;
  /** Swaps the glyph for a spinner and disables the button. */
  loading?: boolean;
  onPress: () => void;
};
