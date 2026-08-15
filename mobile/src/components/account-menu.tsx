import {
  Button as UIButton,
  Menu,
} from '@expo/ui/swift-ui';
import { labelStyle, tint } from '@expo/ui/swift-ui/modifiers';
import { Alert, Platform, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';
import { useAccounts } from '@/api/hooks';
import { setSelectedAccountId, useSelectedAccountId } from '@/lib/account-store';
import { t } from '@lingui/core/macro';
import { AppHost } from '@/components/app-host';

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

  // Always render: iOS 26 wraps every bar item in a glass circle, so a null
  // here still leaves an empty, dead-looking circle in the bar. With a lone
  // account the menu simply shows it checked under "All accounts".
  const list = accounts.data ?? [];

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
        <Icon name={icon} size={18} tintColor={theme.colors.foreground} />
      </Pressable>
    );
  }

  return (
    <AppHost matchContents>
      {/* String label + iconOnly, like TradeFilterMenu — a UIImage label
          measured to zero in headerLeft and never took taps. */}
      <Menu
        label={t`Switch account`}
        systemImage={icon}
        modifiers={[labelStyle('iconOnly'), tint(theme.colors.foreground)]}
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
    </AppHost>
  );
}

const styles = StyleSheet.create(() => ({
  button: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
}));
