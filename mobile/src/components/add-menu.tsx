import {
  Button as UIButton,
  Image as UIImage,
  Menu,
} from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, tint } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { Platform, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';
import { Icon } from '@/components/icon';
import { AppHost } from '@/components/app-host';

/**
 * Header-right "+" — SwiftUI Menu (iOS 26 glass popover anchored to the bar
 * item) fanning out to the creation flows. The trigger stays a plain tinted
 * glyph: iOS 26 wraps every bar item in its own Liquid Glass circle, so any
 * custom chrome would render as a shape nested inside that capsule.
 */
export function AddMenu() {
  const { theme } = useUnistyles();
  const router = useRouter();

  const actions = [
    { label: t`New trade`, systemImage: 'chart.line.uptrend.xyaxis', href: '/new-trade' },
    { label: t`New note`, systemImage: 'note.text', href: '/new-note' },
    { label: t`New setup`, systemImage: 'checklist', href: '/new-setup' },
  ] as const;

  if (Platform.OS !== 'ios') {
    return (
      <Pressable
        onPress={() => router.push(actions[0].href)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t`Add`}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Icon name="plus" size={18} tintColor={theme.colors.foreground} weight="semibold" />
      </Pressable>
    );
  }

  return (
    <AppHost matchContents>
      <Menu
        label={<UIImage systemName="plus" size={17} />}
        modifiers={[
          buttonStyle('plain'),
          // Menu triggers default to the accent tint — keep the glyph neutral.
          tint(theme.colors.foreground),
          accessibilityLabel(t`Add`),
        ]}
      >
        {actions.map((action) => (
          <UIButton
            key={action.href}
            label={action.label}
            systemImage={action.systemImage}
            onPress={() => router.push(action.href)}
          />
        ))}
      </Menu>
    </AppHost>
  );
}

const styles = StyleSheet.create(() => ({
  button: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
}));
