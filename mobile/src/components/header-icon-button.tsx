import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

/**
 * Icon action for a **native** nav bar (`headerRight`) — the shape
 * funding.tsx / api-tokens.tsx already use for their `+`.
 *
 * Draws no chrome of its own on purpose: iOS 26 puts every bar item in a
 * Liquid Glass container, the same one the back chevron sits in, so a
 * `GlassIconButton` here nests a second capsule inside the first and reads
 * dimmer and flatter than the back button beside it. Plain glyph in, system
 * circle around it, and the two sides of the bar match.
 *
 * Not for `FormSheet`'s header — that one is an RN row with no bar item to
 * inherit from, so it draws its own glass (see form-sheet.tsx).
 */
export function HeaderIconButton({
  systemImage,
  label,
  disabled,
  onPress,
}: {
  systemImage: SFSymbol;
  /** Names the button — it shows only a glyph. */
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [styles.button, pressed && !disabled && styles.pressed]}
    >
      <SymbolView
        name={systemImage}
        size={18}
        weight="semibold"
        tintColor={disabled ? theme.colors.mutedForeground : theme.colors.foreground}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create(() => ({
  button: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
}));
