import { useRouter } from 'expo-router';

import { useMe } from '@/api/hooks';
import { useSession } from '@/api/session';
import { ErrorState } from '@/components/error-state';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { SettingsButton, SettingsRow, SettingsSection, ValueText } from '@/components/settings-rows';
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
  const { formatDate } = useFormatters();
  const router = useRouter();
  const { session } = useSession();
  const { changeServer, element: changeServerPrompt } = useChangeServer();
  const me = useMe();

  // The whole screen is /me, so a failure has nothing to sit beside — it gets
  // the full-screen treatment with the retry the old one-liner never offered.
  if (me.isError && !me.data) {
    return (
      <ErrorState error={me.error} onRetry={() => void me.refetch()} retrying={me.isRefetching} />
    );
  }

  if (!me.data) {
    return (
      <SettingsForm>
        <SettingsSection>
          <SettingsRow label={t`Your account`}>
            <ValueText>{t`Loading…`}</ValueText>
          </SettingsRow>
        </SettingsSection>
      </SettingsForm>
    );
  }

  return (
    <SettingsForm>
      {changeServerPrompt}
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
          <ValueText>{me.data.email}</ValueText>
        </SettingsRow>
        <SettingsRow label={t`Role`}>
          <ValueText>{me.data.is_admin ? t`Owner` : t`Member`}</ValueText>
        </SettingsRow>
        <SettingsRow label={t`Member since`}>
          <ValueText>{formatDate(me.data.created_at)}</ValueText>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title={t`Server`}
        footer={t`Self-hosted — your journal never leaves this server.`}
      >
        <SettingsRow label={t`Host`}>
          <ValueText>{serverHost(session?.serverUrl ?? '')}</ValueText>
        </SettingsRow>
        {/* Plain action row, no chevron — it opens a prompt, not a push (NavRow
            doc). The hub carries the same action for the server-unreachable
            case, where this screen is a full-screen error. */}
        <SettingsButton
          label={t`Change server`}
          systemImage="arrow.left.arrow.right"
          onPress={changeServer}
        />
        {/* Owner-only: managing other people's accounts is a property of the
            server, not of your profile, but this is the only screen that
            already knows which one you are signed in to. */}
        {me.data.is_admin ? (
          <NavRow systemImage="person.2" label={t`Users`} onPress={() => router.push('/users')} />
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
  );
}
