import { Section, Text as UIText } from '@expo/ui/swift-ui';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { useSystemInfo } from '@/api/hooks';
import { useSession } from '@/api/session';
import { AppHost } from '@/components/app-host';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { t } from '@lingui/core/macro';
import { normalizeWebBaseUrl, setWebBaseUrl, useWebBaseUrl } from '@/lib/share-prefs';

/** Host only — the full origin is too long for a settings row's value slot. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** What the app talks to: model providers, tokens, and the web app share links point at. */
export default function IntegrationsScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const { session } = useSession();
  const override = useWebBaseUrl();
  const advertised = useSystemInfo().data?.web_url;
  // Same precedence the share sheet uses, so the row shows what links will say.
  const effective = override ?? advertised ?? session?.serverUrl ?? '';
  const source = override != null ? t`Custom` : advertised ? t`From server` : t`Same as server`;

  function editWebBaseUrl() {
    // One value, so Alert.prompt rather than a pushed form (settings idiom).
    Alert.prompt(
      t`Web app address`,
      t`Where share links open. Leave blank to use the address your server reports, or the server itself.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Save`,
          onPress: (text?: string) => {
            try {
              setWebBaseUrl(normalizeWebBaseUrl(text ?? ''));
            } catch {
              Alert.alert(t`Could not save`, t`Enter a web address like https://tm.example.com.`);
            }
          },
        },
      ],
      'plain-text',
      override ?? '',
      'url',
    );
  }

  return (
    <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SettingsForm>
        <Section
          footer={
            <UIText>{t`Keys are stored on your server, never on the device or with third parties.`}</UIText>
          }
        >
          <NavRow
            systemImage="sparkles"
            label={t`AI — vision scan & coach`}
            onPress={() => router.push('/ai')}
          />
          <NavRow
            systemImage="key"
            label={t`API tokens`}
            onPress={() => router.push('/api-tokens')}
          />
        </Section>

        <Section
          footer={
            <UIText>
              {t`Share links are built from this address (${source.toLowerCase()}). Set it when your web app and API live on different domains.`}
            </UIText>
          }
        >
          <NavRow
            systemImage="globe"
            label={t`Web app address`}
            value={effective ? hostOf(effective) : t`Not set`}
            accessory="none"
            onPress={editWebBaseUrl}
          />
        </Section>
      </SettingsForm>
    </AppHost>
  );
}
