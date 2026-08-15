import { RNHostView } from '@expo/ui';
import type { SFSymbol } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';

/**
 * A settings row that pushes another screen, rebuilt for platforms without
 * SwiftUI. iOS overrides this with `nav-row.ios.tsx`, which keeps the composed
 * SwiftUI `Button`/`HStack` row exactly as it shipped.
 *
 * Like `empty-state.tsx`, the Android side is plain RN inside an `RNHostView`
 * rather than universal primitives: `systemImage` is a runtime prop, and
 * universal `Icon` needs an XML drawable literal on Android, so there'd be
 * nothing for Metro to resolve a `require` against. Going through `RNHostView`
 * reuses `@/components/icon`, already mapped to Material Symbols.
 *
 * Same rule as the iOS version: use this only where a tap pushes. A chevron on
 * a row that opens a sheet or leaves the app promises navigation that never
 * happens — `accessory` covers those cases instead.
 */
export function NavRow({
  systemImage,
  label,
  value,
  accessory = 'chevron',
  onPress,
}: {
  systemImage?: SFSymbol;
  label: string;
  value?: string;
  /**
   * `external` for a row that leaves the app (system settings, a browser) — the
   * chevron promises an in-app push, so those rows get the leaving glyph
   * instead. `none` for an action that stays put.
   */
  accessory?: 'chevron' | 'external' | 'none';
  onPress: () => void;
}) {
  const { theme } = useUnistyles();

  return (
    <RNHostView matchContents>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {systemImage != null ? (
          <Icon name={systemImage} size={17} tintColor={theme.colors.foreground} />
        ) : null}
        <Text style={styles.label}>{label}</Text>
        <View style={styles.spacer} />
        {value != null ? <Text style={styles.value}>{value}</Text> : null}
        {accessory === 'none' ? null : (
          <Icon
            name={accessory === 'external' ? 'arrow.up.forward' : 'chevron.right'}
            size={12}
            tintColor={theme.colors.mutedForeground}
          />
        )}
      </Pressable>
    </RNHostView>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  pressed: { backgroundColor: theme.colors.accent },
  label: { fontSize: 17, color: theme.colors.foreground },
  spacer: { flex: 1 },
  value: { fontSize: 15, color: theme.colors.mutedForeground },
}));
