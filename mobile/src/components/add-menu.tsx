import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActionSheetIOS, Platform, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';

/**
 * Header-right "+" — native action sheet fanning out to the creation flows.
 * Just a primary-tinted glyph: iOS 26 wraps every bar item in its own Liquid
 * Glass circle, so any custom filled background renders as a shape nested
 * inside that capsule instead of being the button.
 */
export function AddMenu() {
  const { theme } = useUnistyles();
  const router = useRouter();

  function open() {
    const actions = [
      { label: t`New trade`, href: '/new-trade' as const },
      { label: t`New note`, href: '/new-note' as const },
      { label: t`New setup`, href: '/new-setup' as const },
    ];
    if (Platform.OS !== 'ios') {
      router.push(actions[0].href);
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...actions.map((a) => a.label), t`Cancel`],
        cancelButtonIndex: actions.length,
      },
      (index) => {
        if (index < actions.length) router.push(actions[index].href);
      },
    );
  }

  return (
    <Pressable
      onPress={open}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t`Add`}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <SymbolView name="plus" size={18} tintColor={theme.colors.foreground} weight="semibold" />
    </Pressable>
  );
}

const styles = StyleSheet.create(() => ({
  button: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
}));
