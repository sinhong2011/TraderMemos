import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { Frame, Text } from 'panelui-native';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { useAccounts, useApiRaw } from '@/api/hooks';
import type { ImportPreview, ImportResult } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { Icon } from '@/components/icon';
import { SettingsForm } from '@/components/settings-form';
import {
  SettingsButton,
  SettingsPicker,
  SettingsRow,
  SettingsSection,
  ValueText,
} from '@/components/settings-rows';
import { errorMessage } from '@/lib/errors';
import { shareFile } from '@/lib/file-transfer';
import { useFormatters } from '@/lib/format';
import {
  SAMPLE_CSV,
  SAMPLE_CSV_NAME,
  SAMPLE_JSON,
  SAMPLE_JSON_NAME,
} from '@/lib/import-samples';
import { t } from '@lingui/core/macro';
import { pnlClass } from '@/styles/pnl';

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
  // Position-level exports (cTrader, Match-Trader) map an open/close pair per
  // row instead of a single fill; shown only when the file suggests them.
  { key: 'open_time', label: () => t`Open time`, roundTrip: true },
  { key: 'open_price', label: () => t`Open price`, roundTrip: true },
  { key: 'close_time', label: () => t`Close time`, roundTrip: true },
  { key: 'close_price', label: () => t`Close price`, roundTrip: true },
  { key: 'swap', label: () => t`Swap`, roundTrip: true },
] as const;

/** The formats the server parses, mirroring the web page's "Supported formats". */
const IMPORT_FORMATS: { icon: SFSymbol; name: () => string; body: () => string }[] = [
  {
    icon: 'tablecells',
    name: () => t`Fill CSV`,
    body: () =>
      t`Broker execution exports. Map a Market/Asset Type column for mixed stock/option files, or let the symbol decide.`,
  },
  {
    icon: 'list.bullet.rectangle',
    name: () => t`Journal export`,
    body: () => t`Closed trades with Entry/Exit columns — setup and tags are preserved.`,
  },
  {
    icon: 'curlybraces',
    name: () => t`JSON backup`,
    body: () => t`Full account backup: trades, fills, tags, cash, and the playbook setups catalog.`,
  },
];

type PickedFile = { uri: string; name: string; size: number | null; mimeType: string };

function isJsonFile(file: PickedFile): boolean {
  return file.name.toLowerCase().endsWith('.json') || file.mimeType === 'application/json';
}

/** Peek at a picked JSON file for embedded account metadata (web parity). */
async function readJsonAccountName(file: PickedFile): Promise<string | null> {
  if (!isJsonFile(file)) return null;
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

/** A sentence inside a section card, on the grouped row metrics. */
function NoteRow({ children }: { children: string }) {
  return (
    <Frame.Row>
      <Text size="sm" muted className="flex-1">
        {children}
      </Text>
    </Frame.Row>
  );
}

/**
 * Trades import wizard — the web Import page on the phone. Same server
 * contract: POST /imports parses the upload for a preview (no writes), then
 * POST /imports/commit re-uploads the file with the confirmed column mapping.
 */
export default function ImportTradesScreen() {
  const { formatPnl } = useFormatters();
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRaw();
  const [foreground, mutedForeground] = useCSSVariable([
    '--color-foreground',
    '--color-muted-foreground',
  ]) as [string, string];
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
    // An expo-file-system `File`, not RN's `{uri,name,type}` descriptor — Expo's
    // fetch polyfill owns the global `fetch` and serialises a part only from a
    // string, a Blob, or something with `bytes()`.
    fd.append('file', new File(file!.uri) as unknown as Blob, file!.name);
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
      Alert.alert(t`Could not preview`, errorMessage(err));
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
      Alert.alert(t`Import failed`, errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveSample(kind: 'csv' | 'json') {
    try {
      await (kind === 'csv'
        ? shareFile(SAMPLE_CSV_NAME, SAMPLE_CSV, 'text/csv')
        : shareFile(SAMPLE_JSON_NAME, SAMPLE_JSON, 'application/json'));
    } catch (err) {
      Alert.alert(t`Could not save the sample`, errorMessage(err));
    }
  }

  function reset() {
    setFile(null);
    setJsonAccountName(null);
    setAccountId(null);
    setPreview(null);
    setResult(null);
  }

  // ---- Step 3: result -------------------------------------------------------
  if (result != null) {
    const isJournal = result.format === 'journal_trades';
    return (
      <SettingsForm>
        <SettingsSection title={t`Import complete`}>
          {isJournal ? (
            <SettingsRow label={t`Trades created`}>
              <ValueText>{String(result.trades ?? 0)}</ValueText>
            </SettingsRow>
          ) : null}
          <SettingsRow label={isJournal ? t`Fills inserted` : t`Inserted`}>
            <ValueText>{String(result.inserted)}</ValueText>
          </SettingsRow>
          <SettingsRow label={t`Skipped (duplicates)`}>
            <ValueText>{String(result.skipped)}</ValueText>
          </SettingsRow>
          {(result.annotated ?? 0) > 0 ? (
            <SettingsRow label={t`Journal annotated`}>
              <ValueText>{String(result.annotated)}</ValueText>
            </SettingsRow>
          ) : null}
          {(result.cash_inserted ?? 0) > 0 ? (
            <SettingsRow label={t`Cash transactions`}>
              <ValueText>{String(result.cash_inserted)}</ValueText>
            </SettingsRow>
          ) : null}
          {(result.setups_upserted ?? 0) > 0 ? (
            <SettingsRow label={t`Setups restored`}>
              <ValueText>{String(result.setups_upserted)}</ValueText>
            </SettingsRow>
          ) : null}
        </SettingsSection>

        {result.errors.length > 0 ? (
          <SettingsSection title={t`Errors (${result.errors.length})`}>
            {result.errors.slice(0, 10).map((error, index) => (
              <Frame.Row key={`${error.row}-${index}`}>
                <Text size="sm" className="flex-1 text-destructive">
                  {t`Row ${error.row}: ${error.message}`}
                </Text>
              </Frame.Row>
            ))}
            {result.errors.length > 10 ? (
              <NoteRow>{t`+${result.errors.length - 10} more`}</NoteRow>
            ) : null}
          </SettingsSection>
        ) : null}

        <View className="gap-2">
          <CenteredButton label={t`Done`} onPress={() => router.back()} />
          <CenteredButton role="cancel" label={t`Import another file`} onPress={reset} />
        </View>
      </SettingsForm>
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
      <SettingsForm>
        <SettingsSection
          title={t`File`}
          footer={
            preview.pending_account != null
              ? t`Account "${preview.pending_account.name}" will be created on import.`
              : undefined
          }
        >
          <SettingsRow label={t`File`}>
            <ValueText>{file?.name ?? ''}</ValueText>
          </SettingsRow>
          <SettingsRow label={t`Rows`}>
            <ValueText>{String(preview.row_count ?? 0)}</ValueText>
          </SettingsRow>
          {preview.detected_broker ? (
            <SettingsRow label={t`Detected broker`}>
              <ValueText>{preview.detected_broker}</ValueText>
            </SettingsRow>
          ) : null}
        </SettingsSection>

        {isJournal && summary != null ? (
          <SettingsSection title={t`Summary`}>
            <SettingsRow label={t`Trades`}>
              <ValueText>{String(summary.trade_count)}</ValueText>
            </SettingsRow>
            <SettingsRow label={t`Stocks / options`}>
              <ValueText>{`${summary.stock_trades} / ${summary.option_trades}`}</ValueText>
            </SettingsRow>
            <SettingsRow label={t`Fills`}>
              <ValueText>{String(summary.execution_count)}</ValueText>
            </SettingsRow>
            <SettingsRow label={t`Est. net P&L`}>
              <Text size="sm" className={pnlClass(summary.net_pnl)}>
                {formatPnl(summary.net_pnl)}
              </Text>
            </SettingsRow>
            {summary.error_count > 0 ? (
              <SettingsRow label={t`Rows with errors`}>
                <Text size="sm" className="text-destructive">
                  {String(summary.error_count)}
                </Text>
              </SettingsRow>
            ) : null}
          </SettingsSection>
        ) : null}

        {isJournal && trades.length > 0 ? (
          <SettingsSection
            title={t`Trades`}
            footer={
              trades.length > 20 ? t`+${trades.length - 20} more trades in this file.` : undefined
            }
          >
            {trades.slice(0, 20).map((trade) => (
              <Frame.Row key={trade.row}>
                <Frame.Content>
                  <Frame.Title>{trade.symbol}</Frame.Title>
                  <Text size="sm" muted>
                    {`${trade.market} · ${trade.side} · ${trade.qty}`}
                  </Text>
                </Frame.Content>
                <Frame.Actions>
                  <Text size="sm" className={pnlClass(trade.return_usd)}>
                    {formatPnl(trade.return_usd)}
                  </Text>
                </Frame.Actions>
              </Frame.Row>
            ))}
          </SettingsSection>
        ) : null}

        {isCsvFills ? (
          <SettingsSection
            title={t`Map columns`}
            footer={t`Match each field to a column from the file.`}
          >
            {MAPPABLE_FIELDS.filter(
              (field) =>
                !('roundTrip' in field) ||
                preview.suggested_mapping?.[field.key] != null ||
                mapping[field.key] != null,
            ).map((field) => {
              const value = mapping[field.key] ?? SKIP;
              // Broker presets can pin a constant (`=future`); keep that
              // choice in the menu even after the user moves off it.
              const suggested = preview.suggested_mapping?.[field.key];
              const pinned = suggested?.startsWith('=') ? suggested : null;
              return (
                <SettingsPicker
                  key={field.key}
                  label={field.label()}
                  selectedValue={value}
                  onValueChange={(selection) => {
                    setMapping((current) => ({ ...current, [field.key]: selection }));
                  }}
                  items={[
                    { value: SKIP, label: t`(skip)` },
                    ...(pinned != null
                      ? [{ value: pinned, label: t`Always "${pinned.slice(1)}"` }]
                      : []),
                    ...preview.headers.map((header) => ({ value: header, label: header })),
                  ]}
                />
              );
            })}
          </SettingsSection>
        ) : null}

        {!isJournal && preview.source === 'json' ? (
          <SettingsSection>
            <NoteRow>{t`Fills, journal data, cash, and setups are read directly from the JSON file — nothing to map.`}</NoteRow>
          </SettingsSection>
        ) : null}

        <View className="gap-2">
          <CenteredButton
            label={busy ? t`Importing…` : commitLabel}
            loading={busy}
            onPress={() => {
              if (!busy) void runCommit();
            }}
          />
          <CenteredButton role="cancel" label={t`Back`} onPress={() => setPreview(null)} />
        </View>
      </SettingsForm>
    );
  }

  // ---- Step 1: choose account + file ---------------------------------------
  const sizeLabel =
    file?.size != null ? `${Math.max(1, Math.round(file.size / 1024))} KB` : undefined;
  return (
    <SettingsForm>
      <SettingsSection
        title={t`Account`}
        footer={
          usesFileAccount && jsonAccountName != null
            ? t`Account "${jsonAccountName}" from the JSON file will be matched or created.`
            : undefined
        }
      >
        {(accounts ?? []).length > 0 || jsonAccountName != null ? (
          <SettingsPicker
            label={t`Import into`}
            selectedValue={selectedAccount}
            onValueChange={setAccountId}
            items={[
              ...(jsonAccountName != null
                ? [{ value: ACCOUNT_FROM_FILE, label: t`From file` }]
                : []),
              ...(accounts ?? []).map((account) => ({
                value: account.id,
                label: account.name,
              })),
            ]}
          />
        ) : (
          <NoteRow>{t`No accounts yet — pick a JSON backup with account details, or add an account first.`}</NoteRow>
        )}
      </SettingsSection>

      <SettingsSection
        title={t`File`}
        footer={
          file == null
            ? t`Fill CSVs from your broker, journal CSV exports, or a TraderMemos JSON backup.`
            : t`Tap the file to swap it for another one.`
        }
      >
        {file != null ? (
          <Frame.Row onPress={() => void pickFile()}>
            <Frame.Media>
              <Icon
                name={isJsonFile(file) ? 'curlybraces' : 'tablecells'}
                size={22}
                tintColor={foreground}
              />
            </Frame.Media>
            <Frame.Content>
              <Frame.Title>{file.name}</Frame.Title>
              <Text size="sm" muted>
                {sizeLabel ?? (isJsonFile(file) ? t`JSON backup` : t`CSV file`)}
              </Text>
            </Frame.Content>
            <Frame.Actions>
              <Icon name="arrow.triangle.2.circlepath" size={14} tintColor={mutedForeground} />
            </Frame.Actions>
          </Frame.Row>
        ) : (
          <SettingsButton
            systemImage="doc.badge.plus"
            label={t`Choose CSV or JSON file`}
            onPress={() => void pickFile()}
          />
        )}
      </SettingsSection>

      {/* Disabled rather than alerting: nothing to preview without a file,
          and a tappable button would fire the upload twice while busy. */}
      <CenteredButton
        label={busy ? t`Reading…` : t`Preview import`}
        disabled={busy || file == null}
        loading={busy}
        onPress={() => {
          if (!usesFileAccount && selectedAccount === '') {
            Alert.alert(t`Could not preview`, t`Pick an account first.`);
            return;
          }
          void runPreview();
        }}
      />

      <SettingsSection title={t`Supported formats`}>
        {IMPORT_FORMATS.map((format) => (
          <Frame.Row key={format.icon} align="start">
            <Frame.Media>
              <Icon name={format.icon} size={16} tintColor={mutedForeground} />
            </Frame.Media>
            <Frame.Content>
              <Text size="sm" weight="medium">
                {format.name()}
              </Text>
              <Text size="sm" muted>
                {format.body()}
              </Text>
            </Frame.Content>
          </Frame.Row>
        ))}
      </SettingsSection>

      {/* Web parity: the Import page's sample downloads. Saving through the
          share sheet puts them in Files, where the picker above can reach
          them. */}
      <SettingsSection
        title={t`Sample files`}
        footer={t`Save a starter file to see the expected shape. Your file stays on your server — nothing is sent to third parties.`}
      >
        <SettingsButton
          systemImage="tablecells"
          label={t`Sample CSV`}
          onPress={() => void saveSample('csv')}
        />
        <SettingsButton
          systemImage="curlybraces"
          label={t`Sample JSON`}
          onPress={() => void saveSample('json')}
        />
      </SettingsSection>
    </SettingsForm>
  );
}
