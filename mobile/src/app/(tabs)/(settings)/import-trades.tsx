import {
  Button,
  Host,
  HStack,
  Image,
  LabeledContent,
  Picker,
  Section,
  Spacer,
  Text as UIText,
  VStack,
} from '@expo/ui/swift-ui';
import { font, foregroundStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { useAccounts, useApiRaw } from '@/api/hooks';
import type { ImportPreview, ImportResult } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { SettingsForm } from '@/components/settings-form';
import { formatPnl } from '@/lib/format';
import { t } from '@lingui/core/macro';

/** Synthetic picker choice: let the JSON's embedded account metadata decide. */
const ACCOUNT_FROM_FILE = '__from_file__';

/** Column-skip sentinel — omitted from the mapping sent to commit. */
const SKIP = '__skip__';

/** The canonical fill fields the CSV mapper can bind, mirroring web ImportView. */
const MAPPABLE_FIELDS = [
  { key: 'symbol', label: () => t`Symbol` },
  { key: 'side', label: () => t`Side` },
  { key: 'quantity', label: () => t`Quantity` },
  { key: 'price', label: () => t`Price` },
  { key: 'executed_at', label: () => t`Executed at` },
  { key: 'instrument_type', label: () => t`Instrument` },
  { key: 'option_right', label: () => t`Call / Put` },
  { key: 'fees', label: () => t`Fees` },
  { key: 'commission', label: () => t`Commission` },
] as const;

type PickedFile = { uri: string; name: string; size: number | null; mimeType: string };

/** Peek at a picked JSON file for embedded account metadata (web parity). */
async function readJsonAccountName(file: PickedFile): Promise<string | null> {
  if (!file.name.toLowerCase().endsWith('.json') && file.mimeType !== 'application/json') {
    return null;
  }
  try {
    const raw: unknown = JSON.parse(await new File(file.uri).text());
    if (typeof raw !== 'object' || raw == null) return null;
    const data = raw as { account?: { name?: unknown }; account_name?: unknown };
    const name = data.account?.name ?? data.account_name;
    return typeof name === 'string' && name.trim() !== '' ? name.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Trades import wizard — the web Import page on the phone. Same server
 * contract: POST /imports parses the upload for a preview (no writes), then
 * POST /imports/commit re-uploads the file with the confirmed column mapping.
 */
export default function ImportTradesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRaw();
  const { theme } = useUnistyles();
  const { data: accounts } = useAccounts();

  const [file, setFile] = useState<PickedFile | null>(null);
  const [jsonAccountName, setJsonAccountName] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);

  const selectedAccount =
    accountId ?? (jsonAccountName != null ? ACCOUNT_FROM_FILE : (accounts?.[0]?.id ?? ''));
  const usesFileAccount = selectedAccount === ACCOUNT_FROM_FILE;

  async function pickFile() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/json'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    const next: PickedFile = {
      uri: asset.uri,
      name: asset.name,
      size: asset.size ?? null,
      mimeType: asset.mimeType ?? 'application/octet-stream',
    };
    setFile(next);
    setPreview(null);
    setResult(null);
    const embedded = await readJsonAccountName(next);
    setJsonAccountName(embedded);
    if (embedded != null) {
      setAccountId(ACCOUNT_FROM_FILE);
    } else {
      // Re-picking a CSV after a JSON must drop the file-account choice, or
      // the upload would go out with no account at all.
      setAccountId((current) => (current === ACCOUNT_FROM_FILE ? null : current));
    }
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    // React Native FormData takes a {uri,name,type} descriptor for file parts.
    fd.append('file', {
      uri: file!.uri,
      name: file!.name,
      type: file!.mimeType,
    } as unknown as Blob);
    if (!usesFileAccount && selectedAccount !== '') fd.append('account_id', selectedAccount);
    return fd;
  }

  async function runPreview() {
    setBusy(true);
    try {
      const response = await api('/imports', { method: 'POST', formData: buildFormData() });
      const data = (await response.json()) as ImportPreview;
      // Sent mapping keeps the suggestion only where it names a real header or
      // pins a constant (`=value` from broker presets).
      const initial: Record<string, string> = {};
      for (const field of MAPPABLE_FIELDS) {
        const suggested = data.suggested_mapping?.[field.key];
        if (suggested) initial[field.key] = suggested;
      }
      setMapping(initial);
      setPreview(data);
    } catch (err) {
      Alert.alert(t`Could not preview`, err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function runCommit() {
    if (preview == null) return;
    setBusy(true);
    try {
      const fd = buildFormData();
      const isCsvFills = preview.source === 'csv' && preview.format === 'executions';
      const cleaned = isCsvFills
        ? Object.fromEntries(Object.entries(mapping).filter(([, value]) => value !== SKIP))
        : {};
      fd.append('column_mapping', JSON.stringify(cleaned));
      const response = await api('/imports/commit', { method: 'POST', formData: fd });
      setResult((await response.json()) as ImportResult);
      // Imports touch trades, analytics, cash, setups, tags, and accounts —
      // refetch everything rather than enumerating keys.
      void queryClient.invalidateQueries();
    } catch (err) {
      Alert.alert(t`Import failed`, err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setJsonAccountName(null);
    setAccountId(null);
    setPreview(null);
    setResult(null);
  }

  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' as const });

  // ---- Step 3: result -------------------------------------------------------
  if (result != null) {
    const isJournal = result.format === 'journal_trades';
    return (
      <Host style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <SettingsForm>
          <Section title={t`Import complete`}>
            {isJournal ? (
              <LabeledContent label={t`Trades created`}>
                <UIText>{String(result.trades ?? 0)}</UIText>
              </LabeledContent>
            ) : null}
            <LabeledContent label={isJournal ? t`Fills inserted` : t`Inserted`}>
              <UIText>{String(result.inserted)}</UIText>
            </LabeledContent>
            <LabeledContent label={t`Skipped (duplicates)`}>
              <UIText>{String(result.skipped)}</UIText>
            </LabeledContent>
            {(result.annotated ?? 0) > 0 ? (
              <LabeledContent label={t`Journal annotated`}>
                <UIText>{String(result.annotated)}</UIText>
              </LabeledContent>
            ) : null}
            {(result.cash_inserted ?? 0) > 0 ? (
              <LabeledContent label={t`Cash transactions`}>
                <UIText>{String(result.cash_inserted)}</UIText>
              </LabeledContent>
            ) : null}
            {(result.setups_upserted ?? 0) > 0 ? (
              <LabeledContent label={t`Setups restored`}>
                <UIText>{String(result.setups_upserted)}</UIText>
              </LabeledContent>
            ) : null}
          </Section>
          {result.errors.length > 0 ? (
            <Section title={t`Errors (${result.errors.length})`}>
              {result.errors.slice(0, 10).map((error, index) => (
                <UIText
                  key={`${error.row}-${index}`}
                  modifiers={[font({ size: 13 }), foregroundStyle(theme.colors.destructive)]}
                >
                  {t`Row ${error.row}: ${error.message}`}
                </UIText>
              ))}
              {result.errors.length > 10 ? (
                <UIText modifiers={[secondary]}>{t`+${result.errors.length - 10} more`}</UIText>
              ) : null}
            </Section>
          ) : null}
          <Section>
            <CenteredButton label={t`Done`} onPress={() => router.back()} />
            <CenteredButton label={t`Import another file`} onPress={reset} />
          </Section>
        </SettingsForm>
      </Host>
    );
  }

  // ---- Step 2: review / map columns ----------------------------------------
  if (preview != null) {
    const isJournal = preview.format === 'journal_trades';
    const isCsvFills = preview.source === 'csv' && preview.format === 'executions';
    const summary = preview.journal_summary;
    const trades = preview.sample_trades ?? [];
    const commitLabel = isJournal
      ? t`Import ${summary?.trade_count ?? trades.length} trades`
      : t`Import ${preview.row_count ?? 0} rows`;
    return (
      <Host style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <SettingsForm>
          <Section
            title={t`File`}
            footer={
              preview.pending_account != null ? (
                <UIText>{t`Account "${preview.pending_account.name}" will be created on import.`}</UIText>
              ) : undefined
            }
          >
            <LabeledContent label={t`File`}>
              <UIText>{file?.name ?? ''}</UIText>
            </LabeledContent>
            <LabeledContent label={t`Rows`}>
              <UIText>{String(preview.row_count ?? 0)}</UIText>
            </LabeledContent>
            {preview.detected_broker ? (
              <LabeledContent label={t`Detected broker`}>
                <UIText>{preview.detected_broker}</UIText>
              </LabeledContent>
            ) : null}
          </Section>

          {isJournal && summary != null ? (
            <Section title={t`Summary`}>
              <LabeledContent label={t`Trades`}>
                <UIText>{String(summary.trade_count)}</UIText>
              </LabeledContent>
              <LabeledContent label={t`Stocks / options`}>
                <UIText>{`${summary.stock_trades} / ${summary.option_trades}`}</UIText>
              </LabeledContent>
              <LabeledContent label={t`Fills`}>
                <UIText>{String(summary.execution_count)}</UIText>
              </LabeledContent>
              <LabeledContent label={t`Est. net P&L`}>
                <UIText
                  modifiers={[
                    foregroundStyle(
                      summary.net_pnl >= 0 ? theme.colors.profit : theme.colors.loss,
                    ),
                  ]}
                >
                  {formatPnl(summary.net_pnl)}
                </UIText>
              </LabeledContent>
              {summary.error_count > 0 ? (
                <LabeledContent label={t`Rows with errors`}>
                  <UIText modifiers={[foregroundStyle(theme.colors.destructive)]}>
                    {String(summary.error_count)}
                  </UIText>
                </LabeledContent>
              ) : null}
            </Section>
          ) : null}

          {isJournal && trades.length > 0 ? (
            <Section
              title={t`Trades`}
              footer={
                trades.length > 20 ? (
                  <UIText>{t`+${trades.length - 20} more trades in this file.`}</UIText>
                ) : undefined
              }
            >
              {trades.slice(0, 20).map((trade) => (
                <HStack key={trade.row} spacing={8}>
                  <VStack alignment="leading" spacing={2}>
                    <UIText>{trade.symbol}</UIText>
                    <UIText modifiers={[font({ size: 13 }), secondary]}>
                      {`${trade.market} · ${trade.side} · ${trade.qty}`}
                    </UIText>
                  </VStack>
                  <Spacer />
                  <UIText
                    modifiers={[
                      foregroundStyle(
                        trade.return_usd >= 0 ? theme.colors.profit : theme.colors.loss,
                      ),
                    ]}
                  >
                    {formatPnl(trade.return_usd)}
                  </UIText>
                </HStack>
              ))}
            </Section>
          ) : null}

          {isCsvFills ? (
            <Section
              title={t`Map columns`}
              footer={<UIText>{t`Match each field to a column from the file.`}</UIText>}
            >
              {MAPPABLE_FIELDS.map((field) => {
                const value = mapping[field.key] ?? SKIP;
                // Broker presets can pin a constant (`=future`); keep that
                // choice in the menu even after the user moves off it.
                const suggested = preview.suggested_mapping?.[field.key];
                const pinned = suggested?.startsWith('=') ? suggested : null;
                return (
                  <Picker
                    key={field.key}
                    label={field.label()}
                    selection={value}
                    onSelectionChange={(selection) => {
                      if (selection == null) return;
                      setMapping((current) => ({ ...current, [field.key]: selection }));
                    }}
                  >
                    <UIText modifiers={[tag(SKIP)]}>{t`(skip)`}</UIText>
                    {pinned != null ? (
                      <UIText modifiers={[tag(pinned)]}>{t`Always "${pinned.slice(1)}"`}</UIText>
                    ) : null}
                    {preview.headers.map((header) => (
                      <UIText key={header} modifiers={[tag(header)]}>
                        {header}
                      </UIText>
                    ))}
                  </Picker>
                );
              })}
            </Section>
          ) : null}

          {!isJournal && preview.source === 'json' ? (
            <Section>
              <UIText modifiers={[secondary]}>
                {t`Fills, journal data, cash, and setups are read directly from the JSON file — nothing to map.`}
              </UIText>
            </Section>
          ) : null}

          <Section>
            <CenteredButton
              label={busy ? t`Importing…` : commitLabel}
              onPress={() => {
                if (!busy) void runCommit();
              }}
            />
            <CenteredButton
              label={t`Back`}
              onPress={() => {
                setPreview(null);
              }}
            />
          </Section>
        </SettingsForm>
      </Host>
    );
  }

  // ---- Step 1: choose account + file ---------------------------------------
  const sizeLabel =
    file?.size != null ? `${Math.max(1, Math.round(file.size / 1024))} KB` : undefined;
  return (
    <Host style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SettingsForm>
        <Section
          title={t`Account`}
          footer={
            usesFileAccount && jsonAccountName != null ? (
              <UIText>{t`Account "${jsonAccountName}" from the JSON file will be matched or created.`}</UIText>
            ) : undefined
          }
        >
          {(accounts ?? []).length > 0 || jsonAccountName != null ? (
            <Picker
              label={t`Import into`}
              selection={selectedAccount}
              onSelectionChange={(value) => value != null && setAccountId(value)}
            >
              {jsonAccountName != null ? (
                <UIText modifiers={[tag(ACCOUNT_FROM_FILE)]}>{t`From file`}</UIText>
              ) : null}
              {(accounts ?? []).map((account) => (
                <UIText key={account.id} modifiers={[tag(account.id)]}>
                  {account.name}
                </UIText>
              ))}
            </Picker>
          ) : (
            <UIText modifiers={[secondary]}>
              {t`No accounts yet — pick a JSON backup with account details, or add an account first.`}
            </UIText>
          )}
        </Section>

        <Section
          title={t`File`}
          footer={
            <UIText>
              {t`Fill CSVs from your broker, journal CSV exports, or a TraderMemos JSON backup.`}
            </UIText>
          }
        >
          {file != null ? (
            <Button onPress={() => void pickFile()}>
              <HStack spacing={8}>
                <VStack alignment="leading" spacing={2}>
                  <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
                    {file.name}
                  </UIText>
                  {sizeLabel != null ? (
                    <UIText modifiers={[font({ size: 13 }), secondary]}>{sizeLabel}</UIText>
                  ) : null}
                </VStack>
                <Spacer />
                <Image
                  systemName="arrow.triangle.2.circlepath"
                  size={14}
                  color={theme.colors.mutedForeground}
                />
              </HStack>
            </Button>
          ) : (
            <Button
              systemImage="doc.badge.plus"
              label={t`Choose CSV or JSON file`}
              onPress={() => void pickFile()}
            />
          )}
        </Section>

        <Section>
          <CenteredButton
            label={busy ? t`Reading…` : t`Preview import`}
            onPress={() => {
              if (busy) return;
              if (file == null) {
                Alert.alert(t`Could not preview`, t`Choose a file first.`);
                return;
              }
              if (!usesFileAccount && selectedAccount === '') {
                Alert.alert(t`Could not preview`, t`Pick an account first.`);
                return;
              }
              void runPreview();
            }}
          />
        </Section>
      </SettingsForm>
    </Host>
  );
}
