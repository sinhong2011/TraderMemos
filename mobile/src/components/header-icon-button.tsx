import type { SFSymbol } from 'expo-symbols';
import { Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';

/**
 * Icon action for a **native** nav bar (`headerRight`) — the shape
 * funding.tsx / api-tokens.tsx already use for their `+`.
 *
 * Draws no chrome of its own on purpose: iOS 26 puts every bar item in a
 * Liquid Glass container, the same one the back chevron sits in, so a
 * `GlassIconButton` here nests a second capsule inside the first and reads
 * dimmer and flatter than the back button beside it. Plain glyph in, system
 * circle around it, and the two sides of the bar match. That is also why it
 * stays a bare `Pressable` rather than a PanelUI `Button` — every button
 * variant brings a surface this one must not have.
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
  // `expo-symbols` takes a resolved color, not a class.
  const [foreground, mutedForeground] = useCSSVariable([
    '--color-foreground',
    '--color-muted-foreground',
  ]) as [string, string];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      // A disabled Pressable never reports pressed, so the active state needs
      // no guard of its own.
      className="h-8 w-8 items-center justify-center active:opacity-70"
    >
      <Icon
        name={systemImage}
        size={18}
        weight="semibold"
        tintColor={disabled ? mutedForeground : foreground}
      />
    </Pressable>
  );
}
