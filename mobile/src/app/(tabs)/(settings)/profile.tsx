import { LabeledContent, Section, Text as UIText } from '@expo/ui/swift-ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

import { useMe } from '@/api/hooks';
import { useSession } from '@/api/session';
import { AppHost } from '@/components/app-host';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { formatDate } from '@/lib/format';
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
 * Read-only apart from the password — email changes and 2FA need server work
 * that does not exist yet.
 */
export default function ProfileScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { session } = useSession();
  const me = useMe();

  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' as const });

  if (!me.data) {
    return (
      <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <SettingsForm>
          <Section>
            <UIText modifiers={[secondary]}>
              {me.isError ? t`Could not load your account.` : t`Loading…`}
            </UIText>
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
          <LabeledContent label={t`Email`}>
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
        </Section>

        <Section
          title={t`Security`}
          footer={
            <UIText>
              {me.data.totp_enabled
                ? t`Two-factor authentication is on.`
                : t`Changing your password signs out your other devices. Two-factor authentication isn't available yet.`}
            </UIText>
          }
        >
          <NavRow
            systemImage="lock.rotation"
            label={t`Change password`}
            onPress={() => router.push('/change-password')}
          />
        </Section>
      </SettingsForm>
    </AppHost>
  );
}
