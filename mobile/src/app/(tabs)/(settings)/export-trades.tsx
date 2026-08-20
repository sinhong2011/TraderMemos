import { Frame, Text } from 'panelui-native';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { useAccounts, useApiRaw } from '@/api/hooks';
import type { ExportFormat } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { SettingsForm } from '@/components/settings-form';
import { SettingsPicker, SettingsSection, SettingsToggle } from '@/components/settings-rows';
import { errorMessage } from '@/lib/errors';
import { filenameFromDisposition, shareFile } from '@/lib/file-transfer';
import { t } from '@lingui/core/macro';

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
      Alert.alert(t`Export failed`, errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <SettingsForm>
      <SettingsSection title={t`Account`}>
        {(accounts ?? []).length > 0 ? (
          <SettingsPicker
            label={t`Account`}
            selectedValue={selectedAccount}
            onValueChange={setAccountId}
            items={(accounts ?? []).map((account) => ({
              value: account.id,
              label: account.name,
            }))}
          />
        ) : (
          <Frame.Row>
            <Text size="sm" muted className="flex-1">
              {t`No accounts yet`}
            </Text>
          </Frame.Row>
        )}
      </SettingsSection>

      <SettingsSection
        title={t`Format`}
        footer={formatOptions.find((option) => option.value === format)?.blurb}
      >
        <SettingsPicker
          label={t`Format`}
          selectedValue={format}
          onValueChange={(value) => setFormat(value as ExportFormat)}
          items={formatOptions.map((option) => ({ value: option.value, label: option.label }))}
        />
        {supportsOmit ? (
          <SettingsToggle
            label={t`Omit account details`}
            value={omitAccount}
            onValueChange={setOmitAccount}
          />
        ) : null}
      </SettingsSection>

      {/* Outside a section card: the export is an action on the choices above,
          not another row among them. */}
      <View className="gap-2">
        <CenteredButton
          label={exporting ? t`Preparing…` : t`Download & share`}
          loading={exporting}
          onPress={() => {
            if (!exporting) void download();
          }}
        />
        {supportsOmit && omitAccount ? (
          <Text size="xs" muted className="px-4">
            {t`Strips the account name, broker, and IDs from the export — useful for sharing.`}
          </Text>
        ) : null}
      </View>
    </SettingsForm>
  );
}
