import { Section, Text as UIText } from '@expo/ui/swift-ui';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { AppHost } from '@/components/app-host';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { t } from '@lingui/core/macro';

/**
 * The app itself rather than the trading data — formatting, locale, transfers.
 *
 * Theme is deliberately *not* here: it stays inline on the hub, where it is
 * one tap from anywhere. Everything on this page is set once and forgotten.
 */
export default function GeneralSettingsScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();

  return (
    <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SettingsForm>
        <Section footer={<UIText>{t`Language is set per app in iOS Settings.`}</UIText>}>
          <NavRow
            systemImage="slider.horizontal.3"
            label={t`Display`}
            onPress={() => router.push('/display')}
          />
          <NavRow
            systemImage="globe"
            label={t`Language`}
            accessory="external"
            onPress={() => void Linking.openSettings()}
          />
        </Section>

        <Section
          footer={
            <UIText>{t`Import broker fills or a backup; export trades as JSON, CSV, or ZIP. Config files carry app preferences only.`}</UIText>
          }
        >
          <NavRow
            systemImage="externaldrive"
            label={t`Data & backup`}
            onPress={() => router.push('/data-backup')}
          />
        </Section>
      </SettingsForm>
    </AppHost>
  );
}
