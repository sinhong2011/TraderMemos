import { Button, Form, Host, Section, Text as UIText, Toggle } from '@expo/ui/swift-ui';
import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useAccounts } from '@/api/hooks';
import { useSession } from '@/api/session';
import { t } from '@lingui/core/macro';

/**
 * Built entirely from @expo/ui — this renders a real SwiftUI `Form`, so grouping,
 * insets, dark mode, and Dynamic Type come from the platform rather than our styles.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const { data: accounts } = useAccounts();
  const [confirmDestructive, setConfirmDestructive] = useState(true);
  const appVersion = Application.nativeApplicationVersion ?? '1.0.0';

  function handleSignOut() {
    const disconnect = () => {
      void signOut().then(() => router.replace('/login'));
    };

    if (!confirmDestructive) {
      disconnect();
      return;
    }
    Alert.alert(t`Disconnect?`, t`You will need to sign in again to reach this server.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Disconnect`, style: 'destructive', onPress: disconnect },
    ]);
  }

  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section title={t`Server`}>
          <UIText>{session?.serverUrl ?? t`Not connected`}</UIText>
        </Section>

        <Section title={t`Accounts`}>
          {(accounts ?? []).map((account) => (
            <UIText key={account.id}>
              {account.name} · {account.base_currency}
            </UIText>
          ))}
          {accounts?.length === 0 ? <UIText>{t`No accounts yet`}</UIText> : null}
        </Section>

        <Section title={t`Behavior`}>
          <Toggle
            label={t`Confirm before disconnecting`}
            isOn={confirmDestructive}
            onIsOnChange={setConfirmDestructive}
          />
        </Section>

        <Section title={t`About`}>
          <UIText>{t`Version ${appVersion}`}</UIText>
        </Section>

        <Section>
          <Button role="destructive" label={t`Disconnect`} onPress={handleSignOut} />
        </Section>
      </Form>
    </Host>
  );
}
