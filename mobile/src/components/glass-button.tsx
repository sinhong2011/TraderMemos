import { GlassView } from 'expo-glass-effect';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

/**
 * iOS 26 Liquid Glass capsule button on expo-glass-effect. Built on RN layout
 * (not a SwiftUI Host) so it sizes deterministically inside flex rows — Host
 * matchContents buttons collapse to zero height in the sheet header.
 * `prominent` tints the capsule with the brand primary for the one main action.
 */
export function GlassButton({
  label,
  systemImage,
  prominent,
  disabled,
  onPress,
}: {
  label: string;
  systemImage?: SFSymbol;
  prominent?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  const foreground = prominent ? theme.colors.primaryForeground : theme.colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [(pressed || disabled) && styles.dimmed]}
    >
      <GlassView
        style={styles.capsule}
        glassEffectStyle="regular"
        tintColor={prominent ? theme.colors.primary : undefined}
      >
        {systemImage ? <SymbolView name={systemImage} size={15} tintColor={foreground} /> : null}
        <Text style={[styles.label, { color: foreground }]} numberOfLines={1}>
          {label}
        </Text>
      </GlassView>
    </Pressable>
  );
}

/** Circular glass icon button — sheet close / compact bar actions. */
export function GlassIconButton({
  systemImage,
  label,
  disabled,
  onPress,
}: {
  systemImage: SFSymbol;
  /** Accessibility label — the button shows only the symbol. */
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [(pressed || disabled) && styles.dimmed]}
    >
      <GlassView style={styles.circle} glassEffectStyle="regular">
        <SymbolView name={systemImage} size={15} tintColor={theme.colors.foreground} />
      </GlassView>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs + 2,
    height: 40,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  label: { fontSize: 15, fontWeight: '600' },
  dimmed: { opacity: 0.5 },
}));
