import { Button as UIButton, Host, Image as UIImage, Menu } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, tint } from '@expo/ui/swift-ui/modifiers';
import { useRouter, type Href } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Platform, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';

/**
 * Home-header wrench menu fanning out to the calculators — the phone home of
 * the web Tools popover, placed where the trading day starts. Sheets for the
 * one-shot calculators; the R-calculator and advanced chart push in the Home
 * stack.
 */
export function ToolsMenu() {
  const { theme } = useUnistyles();
  const router = useRouter();

  const actions: { label: string; systemImage: SFSymbol; href: Href }[] = [
    {
      label: t`Position size`,
      systemImage: 'scalemass',
      href: '/tool-position-size',
    },
    { label: t`Kelly criterion`, systemImage: 'percent', href: '/tool-kelly' },
    {
      label: t`Currency converter`,
      systemImage: 'arrow.left.arrow.right',
      href: '/tool-fx',
    },
    {
      label: t`R calculator`,
      systemImage: 'plus.forwardslash.minus',
      href: '/(tabs)/(dashboard)/r-calculator',
    },
    {
      label: t`Advanced chart`,
      systemImage: 'chart.xyaxis.line',
      href: '/(tabs)/(dashboard)/advanced-chart',
    },
  ];

  if (Platform.OS !== 'ios') {
    return (
      <Pressable
        onPress={() => router.push(actions[3].href)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t`Tools`}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <SymbolView name="wrench.and.screwdriver" size={17} tintColor={theme.colors.foreground} />
      </Pressable>
    );
  }

  return (
    <Host matchContents>
      <Menu
        label={<UIImage systemName="wrench.and.screwdriver" size={16} />}
        modifiers={[buttonStyle('plain'), tint(theme.colors.foreground), accessibilityLabel(t`Tools`)]}
      >
        {actions.map((action) => (
          <UIButton
            key={action.label}
            label={action.label}
            systemImage={action.systemImage}
            onPress={() => router.push(action.href)}
          />
        ))}
      </Menu>
    </Host>
  );
}

const styles = StyleSheet.create(() => ({
  button: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
}));
