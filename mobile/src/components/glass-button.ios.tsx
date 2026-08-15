import {
  Button,
  HStack,
  Image as UIImage,
  ProgressView,
  Text as UIText,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  glassEffect,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { type SFSymbol } from 'expo-symbols';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { AppHost } from '@/components/app-host';

/**
 * iOS 26 Liquid Glass buttons — real SwiftUI hosted in RN, not a `GlassView`
 * capsule we draw ourselves. expo-glass-effect's view samples the window
 * behind it, so inside a sheet it flattens to a plain dark fill with none of
 * the material or the press highlight.
 *
 * The material is `.glassEffect`, not the `.glass` *buttonStyle*: that style
 * fills its capsule with an opaque-reading grey on a dark background, which is
 * the flat "filled pill" look. The variant is scheme-dependent and comes from
 * `theme.materials.glass` — see the token for why. `interactive` is what gives
 * the press bloom. The shape lives on the effect, so no `buttonBorderShape` is
 * needed.
 *
 * `Host matchContents` sizes the host to the SwiftUI content, which is what
 * keeps these usable inside flex rows (the sheet header, nav bars).
 *
 * Disabled state is the native modifier, never an RN opacity wrapper — fading
 * a glass surface greys the material instead of the control.
 */
export function GlassButton({
  label,
  systemImage,
  prominent,
  fill,
  disabled,
  onPress,
}: {
  label: string;
  systemImage?: SFSymbol;
  prominent?: boolean;
  /** Stretch to the container width — form actions, not inline chrome. */
  fill?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  const modifiers = [
    // Plain: the button contributes no chrome of its own, the glass is the
    // whole surface. Padding has to come first so the effect covers it.
    buttonStyle('plain'),
    foregroundStyle(theme.colors.foreground),
    padding({ horizontal: 18, vertical: 11 }),
    glassEffect({
      glass: {
        variant: theme.materials.glass,
        interactive: true,
        // Prominent is the one brand action per sheet — a tinted glass, still
        // see-through, rather than a solid fill.
        ...(prominent ? { tint: theme.colors.primary } : {}),
      },
      shape: 'capsule',
    }),
    ...(disabled ? [disabledModifier(true)] : []),
  ];
  const labelFont = font({ size: 15, weight: prominent ? 'semibold' : 'medium' });

  // Width comes from the *label*, not the button: `frame(maxWidth:)` on the
  // button leaves the glass hugging its content, so a full-width action has to
  // expand its content instead (the login.tsx idiom).
  return (
    <AppHost
      matchContents={fill ? { vertical: true } : true}
      style={fill ? styles.fill : undefined}
    >
      <Button onPress={onPress} modifiers={modifiers}>
        <HStack spacing={6} modifiers={fill ? [frame({ maxWidth: 9999 })] : []}>
          {systemImage ? <UIImage systemName={systemImage} size={15} /> : <></>}
          <UIText modifiers={[labelFont]}>{label}</UIText>
        </HStack>
      </Button>
    </AppHost>
  );
}

/** Circular glass icon button — sheet close / compact bar actions. */
export function GlassIconButton({
  systemImage,
  label,
  disabled,
  loading,
  onPress,
}: {
  systemImage: SFSymbol;
  /** Accessibility label — the button shows only the symbol. */
  label: string;
  disabled?: boolean;
  /** Swaps the glyph for a native spinner and disables the button. */
  loading?: boolean;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <AppHost matchContents>
      <Button
        onPress={onPress}
        modifiers={[
          buttonStyle('plain'),
          foregroundStyle(theme.colors.foreground),
          // Even padding around a square glyph is what makes the circle round.
          padding({ all: 11 }),
          glassEffect({
            glass: { variant: theme.materials.glass, interactive: true },
            shape: 'circle',
          }),
          accessibilityLabel(label),
          ...(disabled || loading ? [disabledModifier(true)] : []),
        ]}
      >
        {loading ? (
          // Pinned to the glyph's box so the circle doesn't resize mid-swap.
          <ProgressView modifiers={[frame({ width: 16, height: 16 })]} />
        ) : (
          <UIImage systemName={systemImage} size={16} />
        )}
      </Button>
    </AppHost>
  );
}

const styles = StyleSheet.create(() => ({
  fill: { alignSelf: 'stretch' },
}));
