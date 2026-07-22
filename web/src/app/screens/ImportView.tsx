import { ArrowLeft, ArrowRight, Check, Download, FileText, RefreshCw, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CsvDropZone } from "../../components/CsvDropZone";
import { DataTable } from "../../components/DataTable";
import { ImportJournalDetailModal } from "../../components/ImportJournalDetailModal";
import { ImportStepIndicator } from "../../components/ImportStepIndicator";
import {
  csvSampleColumns,
  journalTradePreviewColumns,
} from "../../components/importPreviewColumns";
import { Panel } from "../../components/Panel";
import { SegmentedControl } from "../../components/SegmentedControl";
import { StatBar } from "../../components/StatBar";
import { SignalField } from "../../components/SignalField";
import { SignalSelect } from "../../components/SignalSelect";
import { Skeleton } from "../../components/Skeleton";
import { Button } from "../../components/ui/button";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { cn } from "../../lib/cn";
import { fmtSignedMoney } from "../../lib/format";
import { intlLocale } from "../../lib/locale";
import { usePrivacyMode } from "../../lib/displayPrefs";
import type {
  Account,
  ImportPreview,
  ImportResult,
  JournalPreviewSummary,
  JournalTradePreview,
} from "../../lib/api/types";
import {
  effectiveOptionRight,
  mergeOptionOverrides,
  type OptionRightOverride,
} from "../../lib/importOptionRight";
import { downloadExport, type ExportFormat } from "../../lib/api/exports";

// Canonical trade fields we want to map
const CANONICAL_FIELDS = [
  "symbol",
  "side",
  "quantity",
  "price",
  "executed_at",
  "instrument_type",
  "option_right",
  "fees",
  "commission",
] as const;

function resolveImportAccountId(accounts: Account[], preferredAccountId?: string): string {
  if (preferredAccountId && accounts.some((account) => account.id === preferredAccountId)) {
    return preferredAccountId;
  }
  return accounts[0]?.id ?? "";
}

function ImportGuidance({ onLogTrade }: { onLogTrade?: () => void }) {
  return (
    <aside className="flex flex-col gap-4 rounded-sharp border border-border bg-bg p-4 lg:sticky lg:top-4">
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-signal">
          Supported formats
        </h2>
        <ul className="mt-3 flex flex-col gap-2.5 text-[12px] leading-relaxed text-text-muted">
          <li>
            <span className="font-medium text-text">Fill CSV</span> — broker execution exports; map
            a Market/Asset Type column for mixed stock/option files, or we infer from the symbol.
          </li>
          <li>
            <span className="font-medium text-text">Journal export</span> — closed trades with
            Entry/Exit columns; setup and tags preserved.
          </li>
          <li>
            <span className="font-medium text-text">JSON export</span> — full account backup with
            trades, fills, tags, cash, and the playbook setups catalog; re-import on this page.
          </li>
        </ul>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Export
        </h3>
        <p className="mt-2 text-[11px] leading-relaxed text-text-dim">
          Switch to Export to download your account as JSON (full backup) or CSV (journal
          spreadsheet). Re-import either format on Import.
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Sample file
        </h3>
        <a
          href="/sample-fill-import.csv"
          download="sample-fill-import.csv"
          className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-accent no-underline transition-opacity hover:opacity-80"
        >
          <FileText size={12} strokeWidth={1.75} />
          Download sample CSV
        </a>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-[11px] leading-relaxed text-text-dim">
          Your CSV stays on your server. Nothing is sent to third parties.
        </p>
      </div>

      {onLogTrade ? (
        <div className="border-t border-border pt-4">
          <Button
            type="button"
            variant="link"
            onClick={onLogTrade}
            className="h-auto text-[11px] text-text-muted hover:text-text"
          >
            Log a trade manually instead →
          </Button>
        </div>
      ) : null}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Step 1 - Upload
// ---------------------------------------------------------------------------

interface Step1Props {
  accounts: Account[];
  accountsLoading: boolean;
  defaultAccountId?: string;
  onPreview: (file: File, accountId: string) => Promise<void>;
  error: string | null;
  loading: boolean;
}

function Step1Upload({
  accounts,
  accountsLoading,
  defaultAccountId,
  onPreview,
  error,
  loading,
}: Step1Props) {
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (accounts.length === 0) return;
    setAccountId((prev) => {
      if (prev && accounts.some((account) => account.id === prev)) return prev;
      return resolveImportAccountId(accounts, defaultAccountId);
    });
  }, [accounts, defaultAccountId]);

  const effectiveAccountId = resolveImportAccountId(accounts, accountId || defaultAccountId);
  const canSubmit = !!file && accounts.length > 0 && !!effectiveAccountId && !loading;

  async function handleSubmit() {
    if (!file || !effectiveAccountId) return;
    await onPreview(file, effectiveAccountId);
  }

  return (
    <Panel title="Upload file" className="rounded-none border-0 lg:border lg:rounded-sharp">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {accountsLoading ? (
          <Skeleton height="36px" />
        ) : (
          <SignalField label="Account">
            <SignalSelect
              value={effectiveAccountId}
              onValueChange={setAccountId}
              ariaLabel="Account select"
              options={
                accounts.length === 0
                  ? [
                      {
                        value: "",
                        label: "No accounts — create one in Settings",
                        disabled: true,
                      },
                    ]
                  : accounts.map((a) => ({ value: a.id, label: a.name }))
              }
              triggerClassName="h-8 text-[12px]"
            />
          </SignalField>
        )}

        <SignalField
          label="File"
          description={file ? undefined : "Select a CSV or JSON file to enable Preview."}
        >
          <CsvDropZone file={file} onFileChange={setFile} disabled={loading} />
        </SignalField>

        {error && <p className="text-[11px] text-loss">{error}</p>}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="button" variant="default" onClick={handleSubmit} disabled={!canSubmit}>
            {loading ? (
              <>
                <RefreshCw size={13} strokeWidth={1.5} className="animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <ArrowRight size={13} strokeWidth={1.5} />
                Preview import
              </>
            )}
          </Button>
          {!file && accounts.length > 0 && (
            <span className="text-[10px] text-text-dim">Upload a CSV or JSON file to continue</span>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Step 2 - Map columns
// ---------------------------------------------------------------------------

function JournalSummaryStrip({
  summary,
  currency,
}: {
  summary: JournalPreviewSummary;
  currency: string;
}) {
  usePrivacyMode();
  const locale = intlLocale();
  const netPnl = fmtSignedMoney(summary.net_pnl, currency, locale);
  const pnlTone = summary.net_pnl >= 0 ? "pos" : "neg";

  return (
    <div className="mb-4 overflow-hidden rounded-sharp border border-border bg-bg">
      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
        <StatBar
          label="Trades"
          value={String(summary.trade_count)}
          sub="round-trips"
          tone="muted"
        />
        <StatBar
          label="Markets"
          value={`${summary.stock_trades} / ${summary.option_trades}`}
          sub="stk / opt"
          tone="accent"
        />
        <StatBar
          label="Fills"
          value={String(summary.execution_count)}
          sub="executions"
          tone="muted"
        />
        <StatBar label="Est. net P&L" value={netPnl} tone={pnlTone} />
      </div>
      {summary.error_count > 0 ? (
        <p className="border-t border-border px-4 py-2.5 text-[11px] text-loss">
          {summary.error_count} row(s) could not be parsed — they will be skipped on import.
        </p>
      ) : null}
    </div>
  );
}

function JournalTradePreviewTable({
  trades,
  currency,
  optionOverrides,
  onOptionRightChange,
}: {
  trades: JournalTradePreview[];
  currency: string;
  optionOverrides: Record<number, OptionRightOverride>;
  onOptionRightChange: (row: number, right: OptionRightOverride) => void;
}) {
  const [detailTrade, setDetailTrade] = useState<JournalTradePreview | null>(null);
  const displayTrades = useMemo(
    () => mergeOptionOverrides(trades, optionOverrides),
    [trades, optionOverrides],
  );
  const columns = useMemo(
    () => journalTradePreviewColumns(currency, setDetailTrade, optionOverrides),
    [currency, optionOverrides],
  );

  return (
    <>
      <DataTable columns={columns} data={displayTrades} dense maxHeight="min(60vh, 520px)" />
      <ImportJournalDetailModal
        trade={detailTrade}
        currency={currency}
        open={detailTrade != null}
        optionRight={detailTrade ? effectiveOptionRight(detailTrade, optionOverrides) : undefined}
        onOptionRightChange={onOptionRightChange}
        onOpenChange={(open) => {
          if (!open) setDetailTrade(null);
        }}
      />
    </>
  );
}

function CsvSamplePreviewTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Record<string, string>[];
}) {
  const columns = useMemo(() => csvSampleColumns(headers), [headers]);

  return <DataTable columns={columns} data={rows} dense maxHeight="min(60vh, 520px)" />;
}

interface Step2Props {
  preview: ImportPreview;
  currency: string;
  onCommit: (
    mapping: Record<string, string>,
    optionOverrides?: Record<number, OptionRightOverride>,
  ) => Promise<void>;
  onBack: () => void;
  error: string | null;
  loading: boolean;
}

function Step2Map({ preview, currency, onCommit, onBack, error, loading }: Step2Props) {
  const isJournal = preview.format === "journal_trades";
  const skipMapping = isJournal || (preview.source === "json" && preview.format === "executions");
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of CANONICAL_FIELDS) {
      initial[field] = preview.suggested_mapping[field] ?? "";
    }
    return initial;
  });
  const [optionOverrides, setOptionOverrides] = useState<Record<number, OptionRightOverride>>({});

  function setField(field: string, value: string) {
    setMapping((prev) => ({ ...prev, [field]: value }));
  }

  function setOptionRight(row: number, right: OptionRightOverride) {
    setOptionOverrides((prev) => ({ ...prev, [row]: right }));
  }

  async function handleCommit() {
    await onCommit(isJournal ? {} : mapping, optionOverrides);
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title={skipMapping ? (isJournal ? "Review journal" : "Review import") : "Map columns"}>
        <div className="p-4 sm:p-5">
          {isJournal ? (
            <>
              <p className="mb-3 text-[12px] leading-relaxed text-text-muted">
                Detected a Stonk Journal / closed-trade export. Each CSV row becomes one round-trip
                trade (2 fills). Setup, tags, and journal fields are applied automatically. Option
                call/put is inferred when possible; open Details to set it on rows marked{" "}
                <span className="text-signal">Set type</span>.
              </p>
              {preview.journal_summary ? (
                <JournalSummaryStrip summary={preview.journal_summary} currency={currency} />
              ) : null}
            </>
          ) : skipMapping ? (
            <p className="mb-3 text-[12px] leading-relaxed text-text-muted">
              Detected a TraderMemos JSON execution export. Fills will be imported directly — no
              column mapping needed.
            </p>
          ) : (
            <p className="mb-3 text-[12px] leading-relaxed text-text-muted">
              Match each field to the corresponding column in your CSV. Instrument type is optional
              — map Market/Asset Type for mixed files, or leave skipped to infer from each symbol.
            </p>
          )}

          {!skipMapping && (
            <div className="flex max-w-lg flex-col gap-3">
              {CANONICAL_FIELDS.map((field) => (
                <SignalField key={field} label={field.replace(/_/g, " ")}>
                  <SignalSelect
                    value={mapping[field] ?? ""}
                    onValueChange={(v) => setField(field, v)}
                    ariaLabel={`Map ${field}`}
                    options={[
                      { value: "", label: "(skip)" },
                      ...preview.headers.map((h) => ({ value: h, label: h })),
                    ]}
                    triggerClassName="h-8 text-[12px]"
                  />
                </SignalField>
              ))}
            </div>
          )}

          {error && <p className="mt-3 text-[11px] text-loss">{error}</p>}

          <div className="mt-4 flex items-center gap-2">
            <Button type="button" variant="default" onClick={handleCommit} disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw size={13} strokeWidth={1.5} className="animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Check size={13} strokeWidth={1.5} />
                  Confirm import
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
              Back
            </Button>
          </div>
        </div>
      </Panel>

      {isJournal && preview.sample_trades && preview.sample_trades.length > 0 ? (
        <Panel
          title={`Trade preview (${preview.journal_summary?.trade_count ?? preview.sample_trades.length})`}
        >
          <JournalTradePreviewTable
            trades={preview.sample_trades}
            currency={currency}
            optionOverrides={optionOverrides}
            onOptionRightChange={setOptionRight}
          />
        </Panel>
      ) : (
        <Panel title="Sample Rows">
          <CsvSamplePreviewTable headers={preview.headers} rows={preview.sample_rows} />
        </Panel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 - Result
// ---------------------------------------------------------------------------

interface Step3Props {
  result: ImportResult;
  onDone: () => void;
  onImportAnother: () => void;
}

function Step3Result({ result, onDone, onImportAnother }: Step3Props) {
  return (
    <Panel title="Import complete">
      <div className="p-5 sm:p-6">
        <div className="flex max-w-md flex-col gap-4">
          <div className="flex items-center gap-2">
            <Check size={16} strokeWidth={1.5} className="text-pos" />
            <span className="text-[13px] font-semibold text-text">Import finished</span>
          </div>

          <div className="rounded-sharp border border-border bg-bg-inset px-4 py-3">
            <div className="flex flex-col gap-2">
              {result.format === "journal_trades" && typeof result.trades === "number" ? (
                <Row label="Trades created" value={String(result.trades)} highlight="pos" />
              ) : null}
              <Row
                label={result.format === "journal_trades" ? "Fills inserted" : "Inserted"}
                value={String(result.inserted)}
                highlight={result.format === "journal_trades" ? undefined : "pos"}
              />
              <Row label="Skipped (duplicates)" value={String(result.skipped)} />
              {typeof result.annotated === "number" && (
                <Row label="Journal annotated" value={String(result.annotated)} />
              )}
              {typeof result.setups_upserted === "number" && result.setups_upserted > 0 ? (
                <Row label="Setups restored" value={String(result.setups_upserted)} />
              ) : null}
              {typeof result.cash_inserted === "number" && result.cash_inserted > 0 ? (
                <Row label="Cash transactions" value={String(result.cash_inserted)} />
              ) : null}
              <Row
                label="Errors"
                value={String(result.errors.length)}
                highlight={result.errors.length > 0 ? "neg" : undefined}
              />
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-sharp border border-loss/20 bg-loss/5 px-3.5 py-2.5">
              <p className="mb-1.5 text-[11px] font-semibold text-loss">Row errors</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-[11px] text-loss">
                  Row {e.row}: {e.message}
                </p>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            <Button type="button" variant="default" onClick={onDone}>
              <Check size={13} strokeWidth={1.5} />
              View dashboard
            </Button>
            <Button type="button" variant="outline" onClick={onImportAnother}>
              <Upload size={13} strokeWidth={1.5} />
              Import another
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "pos" | "neg";
}) {
  return (
    <div className="flex justify-between text-[12px]">
      <span className="text-text-muted">{label}</span>
      <span
        className={cn(
          "tabular-nums font-semibold",
          highlight === "pos" && "text-pos",
          highlight === "neg" && "text-loss",
          !highlight && "text-text",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

interface ExportPanelProps {
  accounts: Account[];
  accountsLoading: boolean;
  defaultAccountId?: string;
}

function ExportPanel({ accounts, accountsLoading, defaultAccountId }: ExportPanelProps) {
  const [accountId, setAccountId] = useState("");
  const [format, setFormat] = useState<ExportFormat>("json");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accounts.length === 0) return;
    setAccountId((prev) => {
      if (prev && accounts.some((account) => account.id === prev)) return prev;
      return resolveImportAccountId(accounts, defaultAccountId);
    });
  }, [accounts, defaultAccountId]);

  const effectiveAccountId = resolveImportAccountId(accounts, accountId || defaultAccountId);
  const canExport = accounts.length > 0 && !!effectiveAccountId && !loading;

  async function handleExport() {
    if (!effectiveAccountId) return;
    setLoading(true);
    setError(null);
    try {
      await downloadExport({ format, accountId: effectiveAccountId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const formatHint =
    format === "csv"
      ? "Journal spreadsheet of closed trades — same account data as JSON, spreadsheet-friendly encoding."
      : "Canonical backup: all trades with fills, journal fields, tags, cash, and the full playbook setups catalog. Re-import this file directly.";

  return (
    <Panel title="Export account" className="rounded-none border-0 lg:border lg:rounded-sharp">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {accountsLoading ? (
          <Skeleton height="36px" />
        ) : (
          <SignalField label="Account">
            <NativeSelect
              value={effectiveAccountId}
              onChange={(event) => setAccountId(event.target.value)}
              aria-label="Export account select"
              size="sm"
              wrapperClassName="w-full"
              className="h-8 text-[12px]"
            >
              {accounts.length === 0 ? (
                <NativeSelectOption value="" disabled>
                  No accounts — create one in Settings
                </NativeSelectOption>
              ) : (
                accounts.map((account) => (
                  <NativeSelectOption key={account.id} value={account.id}>
                    {account.name}
                  </NativeSelectOption>
                ))
              )}
            </NativeSelect>
          </SignalField>
        )}

        <SignalField label="Format">
          <SegmentedControl
            ariaLabel="Export format"
            value={format}
            onChange={(v) => setFormat(v as ExportFormat)}
            options={[
              { value: "json", label: "JSON" },
              { value: "csv", label: "CSV" },
            ]}
          />
        </SignalField>

        <p className="text-[11px] leading-relaxed text-text-muted">{formatHint}</p>

        {error ? <p className="text-[11px] text-loss">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="button"
            variant="default"
            onClick={() => void handleExport()}
            disabled={!canExport}
          >
            {loading ? (
              <>
                <RefreshCw size={13} strokeWidth={1.5} className="animate-spin" />
                Preparing…
              </>
            ) : (
              <>
                <Download size={13} strokeWidth={1.5} />
                Download export
              </>
            )}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Main export - driven by step state
// ---------------------------------------------------------------------------

export interface ImportViewProps {
  accounts: Account[];
  accountsLoading: boolean;
  defaultAccountId?: string;
  onPreview: (formData: FormData) => Promise<ImportPreview>;
  onCommit: (batchId: string, formData: FormData) => Promise<ImportResult>;
  onDone: () => void;
  onLogTrade?: () => void;
  onBack?: () => void;
}

export function ImportView({
  accounts,
  accountsLoading,
  defaultAccountId,
  onPreview,
  onCommit,
  onDone,
  onLogTrade,
  onBack,
}: ImportViewProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dataMode, setDataMode] = useState<"import" | "export">("import");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Keep file + account between steps so commit can resend
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedAccountId, setStagedAccountId] = useState("");

  const importCurrency =
    accounts.find((a) => a.id === stagedAccountId)?.base_currency ??
    accounts.find((a) => a.id === defaultAccountId)?.base_currency ??
    accounts[0]?.base_currency ??
    "USD";

  async function handlePreview(file: File, accountId: string) {
    setLoading(true);
    setStepError(null);
    setStagedFile(file);
    setStagedAccountId(accountId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("account_id", accountId);
      const data = await onPreview(fd);
      setPreview(data);
      setStep(2);
    } catch (e) {
      setStepError(
        e instanceof Error ? e.message : "Preview failed. Check your CSV and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit(
    mapping: Record<string, string>,
    optionOverrides: Record<number, OptionRightOverride> = {},
  ) {
    if (!preview || !stagedFile) return;
    setLoading(true);
    setStepError(null);
    try {
      const fd = new FormData();
      fd.append("file", stagedFile);
      fd.append("column_mapping", JSON.stringify(mapping));
      if (preview.format === "journal_trades" && Object.keys(optionOverrides).length > 0) {
        fd.append("journal_option_overrides", JSON.stringify(optionOverrides));
      }
      const data = await onCommit(preview.import_batch_id, fd);
      setResult(data);
      setStep(3);
    } catch (e) {
      setStepError(e instanceof Error ? e.message : "Import failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleImportAnother() {
    setStep(1);
    setPreview(null);
    setResult(null);
    setStepError(null);
    setStagedFile(null);
    setStagedAccountId("");
  }

  return (
    <div className="flex min-h-full flex-col px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {onBack && step === 1 && (
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="mb-2 h-auto gap-1 px-0 text-[11px] text-text-dim hover:bg-transparent hover:text-text-muted"
            >
              <ArrowLeft size={12} strokeWidth={1.75} />
              Back to dashboard
            </Button>
          )}
          <h1 className="text-[15px] font-semibold tracking-tight text-text">Import & export</h1>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-text-muted">
            {dataMode === "import"
              ? "Upload broker history to populate your journal and analytics."
              : "Download your trades or fills for backup and portability."}
          </p>
        </div>
        <SegmentedControl
          ariaLabel="Import or export"
          value={dataMode}
          onChange={(v) => setDataMode(v as "import" | "export")}
          options={[
            { value: "import", label: "Import" },
            { value: "export", label: "Export" },
          ]}
        />
      </div>

      {dataMode === "export" ? (
        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] lg:items-start">
          <ExportPanel
            accounts={accounts}
            accountsLoading={accountsLoading}
            defaultAccountId={defaultAccountId}
          />
          <ImportGuidance onLogTrade={onLogTrade} />
        </div>
      ) : (
        <>
          <ImportStepIndicator current={step} format={preview?.format} />

          {step === 1 && (
            <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] lg:items-start">
              <Step1Upload
                accounts={accounts}
                accountsLoading={accountsLoading}
                defaultAccountId={defaultAccountId}
                onPreview={handlePreview}
                error={stepError}
                loading={loading}
              />
              <ImportGuidance onLogTrade={onLogTrade} />
            </div>
          )}

          {step === 2 && preview && (
            <div className="mx-auto w-full max-w-4xl flex-1">
              <Step2Map
                preview={preview}
                currency={importCurrency}
                onCommit={handleCommit}
                onBack={() => {
                  setStep(1);
                  setStepError(null);
                }}
                error={stepError}
                loading={loading}
              />
            </div>
          )}

          {step === 3 && result && (
            <div className="mx-auto w-full max-w-lg flex-1">
              <Step3Result result={result} onDone={onDone} onImportAnother={handleImportAnother} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
