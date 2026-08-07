import { LabeledContent, Section, Text as UIText } from '@expo/ui/swift-ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

import { useMe } from '@/api/hooks';
import { useSession } from '@/api/session';
import { AppHost } from '@/components/app-host';
import { ErrorState } from '@/components/error-state';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { useFormatters } from '@/lib/format';
import { t } from '@lingui/core/macro';

/** `https://host:port/path` → `host` — the part that identifies the server. */
function serverHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

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
          <Section>
            <UIText modifiers={[secondary]}>{t`Loading…`}</UIText>
          </Section>
        </SettingsForm>
      </AppHost>
    );
  }

  return (
    <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SettingsForm>
        <Section
          title={t`Signed in as`}
          footer={
            me.data.is_admin ? (
              <UIText>{t`The owner account — the first user created on this server.`}</UIText>
            ) : undefined
          }
        >
          {/* "Username", not "Email": the wire field is `email`, but nothing
              validates it as one and the sign-in screen asks for a username,
              so that is what this account actually has. */}
          <LabeledContent label={t`Username`}>
            <UIText>{me.data.email}</UIText>
          </LabeledContent>
          <LabeledContent label={t`Role`}>
            <UIText>{me.data.is_admin ? t`Owner` : t`Member`}</UIText>
          </LabeledContent>
          <LabeledContent label={t`Member since`}>
            <UIText>{formatDate(me.data.created_at)}</UIText>
          </LabeledContent>
        </Section>

        <Section
          title={t`Server`}
          footer={<UIText>{t`Self-hosted — your journal never leaves this server.`}</UIText>}
        >
          <LabeledContent label={t`Host`}>
            <UIText>{serverHost(session?.serverUrl ?? '')}</UIText>
          </LabeledContent>
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
        </Section>

        <Section
          title={t`Security`}
          footer={
            <UIText>
              {t`Changing your password signs out your other devices.`}
            </UIText>
          }
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
        </Section>
      </SettingsForm>
    </AppHost>
  );
}
