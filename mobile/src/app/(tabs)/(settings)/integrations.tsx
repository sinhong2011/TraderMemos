import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

import { useSystemInfo } from '@/api/hooks';
import { AppHost } from '@/components/app-host';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { SettingsSection } from '@/components/settings-rows';
import { t } from '@lingui/core/macro';
import { useWebBaseUrl } from '@/lib/share-prefs';

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
  const override = useWebBaseUrl();
  const advertised = useSystemInfo().data?.web_url;
  // Same resolution the share sheet uses, so the row shows what links will say.
  // No API-origin fallback — see the note in app/share-reports-link.tsx.
  const effective = override ?? advertised ?? null;
  const source = override != null ? t`Custom` : advertised ? t`From server` : t`Not set`;

  return (
    <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SettingsForm>
        <SettingsSection
          footer={t`Keys are stored on your server, never on the device or with third parties.`}
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
        </SettingsSection>

        <SettingsSection
          footer={effective
                ? t`Share links are built from this address (${source.toLowerCase()}).`
                : t`Share links need this address. Your server doesn't advertise one, so set the domain your web app is served from.`}
        >
          <NavRow
            systemImage="globe"
            label={t`Web app address`}
            value={effective ? hostOf(effective) : t`Not set`}
            onPress={() => router.push('/web-address')}
          />
        </SettingsSection>
      </SettingsForm>
    </AppHost>
  );
}
