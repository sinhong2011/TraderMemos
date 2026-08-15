import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';

import type { GlassButtonProps, GlassIconButtonProps } from './glass-button.types';

/**
 * The glass button pair, in its cross-platform form. `glass-button.ios.tsx`
 * keeps the real SwiftUI `glassEffect` originals; both export the same names,
 * so the call sites never branch. (As with `settings-form`, the universal file
 * has to be the unsuffixed one — TypeScript only resolves the base name.)
 *
 * Liquid Glass is not a material Android has, and nothing in `@expo/ui`'s
 * Compose surface approximates it: there is no `glassEffect` modifier, and
 * universal `Button` maps to a filled Material button with no icon slot. So
 * rather than fake a translucent capsule badly — a semi-transparent fill over
 * an opaque card reads as a muddy grey blob, not as glass — this draws the
 * honest Material translation: a solid capsule on `fill`, the same token the
 * app already uses for compact picker tracks and plain fields.
 *
 * The one thing that must survive the translation is *rank*: `prominent` is the
 * single brand action in a sheet, so it keeps the primary fill and its paired
 * foreground, exactly as the tinted glass reads on iOS.
 *
 * Plain RN rather than `RNHostView`: unlike the settings rows, these mount in
 * ordinary React Native trees (sheet headers, nav bars, the calendar toolbar),
 * so there is no hosted subtree to join and a host here would only add a
 * measuring pass.
 */
export function GlassButton({
  label,
  systemImage,
  prominent,
  fill,
  disabled,
  onPress,
}: GlassButtonProps) {
  const { theme } = useUnistyles();
  const tint = prominent ? theme.colors.primaryForeground : theme.colors.foreground;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        prominent ? styles.prominent : styles.plain,
        fill && styles.fill,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        {systemImage ? <Icon name={systemImage} size={15} tintColor={tint} /> : null}
        <Text style={[styles.label, prominent && styles.labelProminent, { color: tint }]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/** Circular icon button — sheet close / compact bar actions. */
export function GlassIconButton({
  systemImage,
  label,
  disabled,
  loading,
  onPress,
}: GlassIconButtonProps) {
  const { theme } = useUnistyles();
  const off = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        styles.iconButton,
        styles.plain,
        pressed && styles.pressed,
        off && styles.disabled,
      ]}
    >
      {loading ? (
        // Sized to the glyph's box so the circle doesn't resize mid-swap.
        <ActivityIndicator size="small" color={theme.colors.foreground} />
      ) : (
        <Icon name={systemImage} size={16} tintColor={theme.colors.foreground} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
  },
  plain: { backgroundColor: theme.colors.fill },
  prominent: { backgroundColor: theme.colors.primary },
  fill: { alignSelf: 'stretch' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 15, fontWeight: '500' },
  labelProminent: { fontWeight: '600' },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
  },
}));
