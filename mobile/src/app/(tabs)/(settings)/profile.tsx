import { Text as UIText } from '@expo/ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

import { useMe } from '@/api/hooks';
import { useSession } from '@/api/session';
import { AppHost } from '@/components/app-host';
import { ErrorState } from '@/components/error-state';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { SettingsButton, SettingsRow, SettingsSection } from '@/components/settings-rows';
import { serverHost, useChangeServer } from '@/lib/change-server';
import { useFormatters } from '@/lib/format';
import { t } from '@lingui/core/macro';

/**
 * The signed-in account. Until /me existed the app could not say who you were:
 * the session holds a server URL and two opaque tokens, nothing more.
 *
 * Read-only apart from the password and the second factor; an owner also
 * reaches the server's other accounts from here.
 */
export default function ProfileScreen() {
  const { theme } = useUnistyles();
  const { formatDate } = useFormatters();
  const router = useRouter();
  const { session } = useSession();
  const changeServer = useChangeServer();
  const me = useMe();

  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' as const });

  // The whole screen is /me, so a failure has nothing to sit beside — it gets
  // the full-screen treatment with the retry the old one-liner never offered.
  if (me.isError && !me.data) {
    return (
      <ErrorState error={me.error} onRetry={() => void me.refetch()} retrying={me.isRefetching} />
    );
  }

  if (!me.data) {
    return (
      <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <SettingsForm>
          <SettingsSection>
            <UIText modifiers={[secondary]}>{t`Loading…`}</UIText>
          </SettingsSection>
        </SettingsForm>
      </AppHost>
    );
  }

  return (
    <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SettingsForm>
        <SettingsSection
          title={t`Signed in as`}
          footer={
            me.data.is_admin
              ? t`The owner account — the first user created on this server.`
              : undefined
          }
        >
          {/* "Username", not "Email": the wire field is `email`, but nothing
              validates it as one and the sign-in screen asks for a username,
              so that is what this account actually has. */}
          <SettingsRow label={t`Username`}>
            <UIText>{me.data.email}</UIText>
          </SettingsRow>
          <SettingsRow label={t`Role`}>
            <UIText>{me.data.is_admin ? t`Owner` : t`Member`}</UIText>
          </SettingsRow>
          <SettingsRow label={t`Member since`}>
            <UIText>{formatDate(me.data.created_at)}</UIText>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          title={t`Server`}
          footer={t`Self-hosted — your journal never leaves this server.`}
        >
          <SettingsRow label={t`Host`}>
            <UIText>{serverHost(session?.serverUrl ?? '')}</UIText>
          </SettingsRow>
          {/* Plain Button, no chevron — it opens a prompt, not a push (NavRow
              doc). The hub carries the same action for the server-unreachable
              case, where this screen is a full-screen error. */}
          <SettingsButton label={t`Change server`} systemImage="arrow.left.arrow.right" onPress={changeServer} />
          {/* Owner-only: managing other people's accounts is a property of the
              server, not of your profile, but this is the only screen that
              already knows which one you are signed in to. */}
          {me.data.is_admin ? (
            <NavRow
              systemImage="person.2"
              label={t`Users`}
              onPress={() => router.push('/users')}
            />
          ) : null}
        </SettingsSection>

        <SettingsSection
          title={t`Security`}
          footer={t`Changing your password signs out your other devices.`}
        >
          <NavRow
            systemImage="lock.rotation"
            label={t`Change password`}
            onPress={() => router.push('/change-password')}
          />
          <NavRow
            systemImage="lock.shield"
            label={t`Two-factor authentication`}
            value={me.data.totp_enabled ? t`On` : t`Off`}
            onPress={() => router.push('/two-factor')}
          />
        </SettingsSection>
      </SettingsForm>
    </AppHost>
  );
}
