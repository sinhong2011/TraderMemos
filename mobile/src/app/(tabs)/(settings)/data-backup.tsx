import {
  Button,
  Section,
  Text as UIText,
} from '@expo/ui/swift-ui';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { useSession } from '@/api/session';
import { SettingsForm } from '@/components/settings-form';
import { buildAppConfigExport, parseAppConfig } from '@/lib/app-config';
import { shareFile } from '@/lib/file-transfer';
import { applyJournalPrefs } from '@/lib/journal-prefs';
import { applyDisplayPrefs } from '@/lib/prefs';
import { t } from '@lingui/core/macro';
import { AppHost } from '@/components/app-host';

/**
 * Every import/export in one place, one push away from Settings. Trade data
 * round-trips through the server (its own wizards); app-config files are
 * device-local preferences handled inline — no API involved.
 */
export default function DataBackupScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const { session } = useSession();

  async function exportAppConfig() {
    try {
      const date = new Date().toISOString().slice(0, 10);
      await shareFile(
        `tradermemos-app-config-${date}.json`,
        buildAppConfigExport(session?.serverUrl ?? ''),
        'application/json',
      );
    } catch (err) {
      Alert.alert(t`Could not export config`, err instanceof Error ? err.message : String(err));
    }
  }

  async function importAppConfig() {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/json'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;
      const parsed = parseAppConfig(await new File(picked.assets[0].uri).text());
      // The prefs store is module-level and notifies its subscribers, so the
      // Display screen and every money formatter pick this up immediately.
      if (parsed.displayPrefs != null) applyDisplayPrefs(parsed.displayPrefs);
      if (parsed.journalPrefs != null) applyJournalPrefs(parsed.journalPrefs);
      // The server URL is part of the signed-in session, so a differing
      // api_base is reported rather than applied.
      const serverNote =
        parsed.apiBase !== undefined && parsed.apiBase !== session?.serverUrl
          ? t`The file's server URL (${parsed.apiBase}) was not applied — sign out and sign in again to switch servers.`
          : undefined;
      Alert.alert(t`App config imported`, serverNote);
    } catch (err) {
      Alert.alert(t`Could not import config`, err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SettingsForm>
        <Section
          title={t`Trades`}
          footer={
            <UIText>
              {t`Import broker fills, a journal CSV, or a TraderMemos backup. Exports come out as JSON, CSV, or a ZIP with screenshots.`}
            </UIText>
          }
        >
          <Button
            systemImage="square.and.arrow.down"
            label={t`Import trades`}
            onPress={() => router.push('/import-trades')}
          />
          <Button
            systemImage="square.and.arrow.up"
            label={t`Export data`}
            onPress={() => router.push('/export-trades')}
          />
        </Section>

        <Section
          title={t`App config`}
          footer={
            <UIText>
              {t`Config files carry this device's app preferences only — no trades, no credentials. They round-trip with the web app.`}
            </UIText>
          }
        >
          <Button
            systemImage="arrow.up.doc"
            label={t`Import app config`}
            onPress={() => void importAppConfig()}
          />
          <Button
            systemImage="arrow.down.doc"
            label={t`Export app config`}
            onPress={() => void exportAppConfig()}
          />
        </Section>
      </SettingsForm>
    </AppHost>
  );
}
