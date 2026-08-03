import { Button as UIButton, Host, Image as UIImage, Menu } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, tint } from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import { Alert, Platform, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useAccounts } from '@/api/hooks';
import { setSelectedAccountId, useSelectedAccountId } from '@/lib/account-store';
import { t } from '@lingui/core/macro';

/**
 * Header account scope switcher — SwiftUI Menu listing every account plus
 * "All accounts", with a checkmark on the active pick. The trigger glyph
 * switches from the neutral outline to the filled variant when a single
 * account is scoped, so the narrowed view is visible at a glance without a
 * label crowding the bar.
 */
export function AccountMenu() {
  const { theme } = useUnistyles();
  const accounts = useAccounts();
  const selectedId = useSelectedAccountId();

  // Nothing to switch between — a lone account is always the scope anyway.
  const list = accounts.data ?? [];
  if (list.length < 2) return null;

  const scoped = selectedId != null && list.some((account) => account.id === selectedId);
  const icon = scoped ? 'person.crop.circle.fill' : 'person.crop.circle';

  if (Platform.OS !== 'ios') {
    return (
      <Pressable
        onPress={() => {
          Alert.alert(
            t`Account`,
            undefined,
            [
              { text: t`All accounts`, onPress: () => setSelectedAccountId(null) },
              ...list.map((account) => ({
                text: account.name,
                onPress: () => setSelectedAccountId(account.id),
              })),
              { text: t`Cancel`, style: 'cancel' as const },
            ],
          );
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t`Switch account`}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <SymbolView name={icon} size={18} tintColor={theme.colors.foreground} />
      </Pressable>
    );
  }

  return (
    <Host matchContents>
      <Menu
        label={<UIImage systemName={icon} size={17} />}
        modifiers={[
          buttonStyle('plain'),
          // Menu triggers default to the accent tint — keep the glyph neutral.
          tint(theme.colors.foreground),
          accessibilityLabel(t`Switch account`),
        ]}
      >
        <UIButton
          label={t`All accounts`}
          systemImage={scoped ? undefined : 'checkmark'}
          onPress={() => setSelectedAccountId(null)}
        />
        {list.map((account) => (
          <UIButton
            key={account.id}
            label={account.name}
            systemImage={selectedId === account.id ? 'checkmark' : undefined}
            onPress={() => setSelectedAccountId(account.id)}
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
