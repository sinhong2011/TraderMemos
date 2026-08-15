import type { SFSymbol } from 'expo-symbols';
import { Button } from 'panelui-native';
import { ActivityIndicator } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';

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

/**
 * Sheet / overlay chrome actions, one file for both platforms.
 *
 * The pair used to be a SwiftUI `glassEffect` original (`glass-button.ios.tsx`)
 * beside a hand-drawn Material translation; PanelUI's `Button` now covers both
 * from one call, so the split is gone and with it the two implementations that
 * had to be kept in step.
 *
 * The labelled button stays **drawn**, not `native`: it carries an optional
 * glyph beside its label, and a native button can only host elements when its
 * width is fixed by something above it — a labelled one's is its text's, which
 * is nobody's, and hosting there takes the app down in native code where a JS
 * `try` has nothing to catch. Drawn, it also keeps `fill`, the theme tokens and
 * the icon tint.
 *
 * The one thing that must survive from the SwiftUI original is *rank*:
 * `prominent` is the single brand action in a sheet, so it keeps the primary
 * fill and its paired foreground, exactly as the tinted glass read on iOS.
 */
export function GlassButton({
  label,
  systemImage,
  prominent,
  fill,
  disabled,
  onPress,
}: GlassButtonProps) {
  // The glyph is an `expo-symbols` view, not a PanelUI icon, so it does not
  // inherit the button's `IconColorProvider` — it needs the resolved token.
  const [primaryForeground, secondaryForeground] = useCSSVariable([
    '--color-primary-foreground',
    '--color-secondary-foreground',
  ]) as [string, string];
  const tint = prominent ? primaryForeground : secondaryForeground;

  return (
    <Button
      variant={prominent ? 'primary' : 'secondary'}
      fullWidth={fill}
      disabled={disabled}
      onPress={onPress}
      startContent={
        systemImage ? <Icon name={systemImage} size={15} tintColor={tint} /> : undefined
      }
    >
      {label}
    </Button>
  );
}

/**
 * Circular icon button — sheet close / compact bar actions.
 *
 * This one *is* native: an icon button is a square PanelUI sizes itself, which
 * is the case where hosting a view inside the platform button is safe, and it
 * is what buys the real Liquid Glass material on iOS 26. Android has no such
 * material, so Compose draws its own round button there — the intended
 * fallback, not a downgrade.
 */
export function GlassIconButton({
  systemImage,
  label,
  disabled,
  loading,
  onPress,
}: GlassIconButtonProps) {
  const [foreground] = useCSSVariable(['--color-foreground']) as [string];
  const off = disabled || loading;

  return (
    <Button
      native
      glass
      size="icon"
      variant="ghost"
      disabled={off}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
    >
      {loading ? (
        // `size="icon"` fixes the button's square, so swapping the glyph for
        // the spinner cannot resize the circle under the finger.
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <Icon name={systemImage} size={16} tintColor={foreground} />
      )}
    </Button>
  );
}
