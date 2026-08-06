import { Section, Text as UIText } from '@expo/ui/swift-ui';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

import { AppHost } from '@/components/app-host';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { t } from '@lingui/core/macro';

/** What the app talks to: model providers and the tokens other tools use. */
export default function IntegrationsScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();

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
      </SettingsForm>
    </AppHost>
  );
}
