import { useRouter } from 'expo-router';

import { useMe } from '@/api/hooks';
import { ErrorState } from '@/components/error-state';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { SettingsRow, SettingsSection, ValueText } from '@/components/settings-rows';
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

      {/* No Host / Change server here — the hub's Server row is the one place
          that edits the connection (it must stay reachable when the server
          isn't, which is exactly when this screen is a full-screen error).
          Owner-only: managing other people's accounts is a property of the
          server, not of your profile, but this is the only screen that
          already knows which one you are signed in to. */}
      {me.data.is_admin ? (
        <SettingsSection title={t`Server`}>
          <NavRow systemImage="person.2" label={t`Users`} onPress={() => router.push('/users')} />
        </SettingsSection>
      ) : null}

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
