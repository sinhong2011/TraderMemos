import {
  Picker,
  Section,
  Text as UIText,
  Toggle,
} from '@expo/ui/swift-ui';
import { tag } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { useAccounts, useApiRaw } from '@/api/hooks';
import type { ExportFormat } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { SettingsForm } from '@/components/settings-form';
import { filenameFromDisposition, shareFile } from '@/lib/file-transfer';
import { t } from '@lingui/core/macro';
import { AppHost } from '@/components/app-host';

const EXPORT_MIME: Record<ExportFormat, string> = {
  json: 'application/json',
  csv: 'text/csv',
  zip: 'application/zip',
};

/**
 * Trades/data export — GET /exports handed to the share sheet (web ExportView
 * parity: account, json/csv/zip, omit-account for the canonical formats).
 */
export default function ExportTradesScreen() {
  const { theme } = useUnistyles();
  const api = useApiRaw();
  const { data: accounts } = useAccounts();

  const [accountId, setAccountId] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>('json');
  const [omitAccount, setOmitAccount] = useState(false);
  const [exporting, setExporting] = useState(false);

  const selectedAccount = accountId ?? accounts?.[0]?.id ?? '';

  const formatOptions: { value: ExportFormat; label: string; blurb: string }[] = [
    {
      value: 'json',
      label: t`JSON backup`,
      blurb: t`Canonical backup — trades, fills, journal, cash, and playbook setups. Re-importable.`,
    },
    { value: 'csv', label: t`CSV journal`, blurb: t`Journal spreadsheet of closed trades.` },
    {
      value: 'zip',
      label: t`ZIP archive`,
      blurb: t`export.json plus trade screenshots under attachments/.`,
    },
  ];
  const supportsOmit = format !== 'csv';

  async function download() {
    if (!selectedAccount) {
      Alert.alert(t`Export failed`, t`Create an account first.`);
      return;
    }
    setExporting(true);
    try {
      const response = await api('/exports', {
        params: {
          account_id: selectedAccount,
          format,
          ...(supportsOmit && omitAccount ? { omit_account: '1' } : {}),
        },
      });
      const name =
        filenameFromDisposition(response.headers.get('content-disposition')) ??
        `tradermemos-export.${format}`;
      const content =
        format === 'zip'
          ? await response.arrayBuffer()
          : format === 'json'
            ? // Match the web export: human-readable indented JSON.
              JSON.stringify(await response.json(), null, 2)
            : await response.text();
      await shareFile(name, content, EXPORT_MIME[format]);
    } catch (err) {
      Alert.alert(t`Export failed`, err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SettingsForm>
        <Section title={t`Account`}>
          {(accounts ?? []).length > 0 ? (
            <Picker
              label={t`Account`}
              selection={selectedAccount}
              onSelectionChange={(value) => value != null && setAccountId(value)}
            >
              {(accounts ?? []).map((account) => (
                <UIText key={account.id} modifiers={[tag(account.id)]}>
                  {account.name}
                </UIText>
              ))}
            </Picker>
          ) : (
            <UIText>{t`No accounts yet`}</UIText>
          )}
        </Section>

        <Section
          title={t`Format`}
          footer={<UIText>{formatOptions.find((option) => option.value === format)?.blurb}</UIText>}
        >
          <Picker
            label={t`Format`}
            selection={format}
            onSelectionChange={(value) => value != null && setFormat(value as ExportFormat)}
          >
            {formatOptions.map((option) => (
              <UIText key={option.value} modifiers={[tag(option.value)]}>
                {option.label}
              </UIText>
            ))}
          </Picker>
          {supportsOmit ? (
            <Toggle label={t`Omit account details`} isOn={omitAccount} onIsOnChange={setOmitAccount} />
          ) : null}
        </Section>

        <Section
          footer={
            supportsOmit && omitAccount ? (
              <UIText>
                {t`Strips the account name, broker, and IDs from the export — useful for sharing.`}
              </UIText>
            ) : undefined
          }
        >
          <CenteredButton
            label={exporting ? t`Preparing…` : t`Download & share`}
            onPress={() => {
              if (!exporting) void download();
            }}
          />
        </Section>
      </SettingsForm>
    </AppHost>
  );
}
