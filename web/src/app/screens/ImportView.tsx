import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileJson,
  FileText,
  Info,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CsvDropZone } from "@/components/CsvDropZone";
import { DataTable } from "@/components/DataTable";
import { ImportStepIndicator } from "@/components/ImportStepIndicator";
import { csvSampleColumns, journalTradePreviewColumns } from "@/components/importPreviewColumns";
import { Panel } from "@/components/Panel";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Field } from "@/components/Field";
import { ControlledPopover } from "@/components/ControlledPopover";
import { OptionsSelect } from "@/components/OptionsSelect";
import { ToneToggle } from "@/components/ToneToggle";
import { Skeleton } from "@/components/Skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { downloadExport, type ExportFormat } from "@/lib/api/exports";
import type {
  Account,
  ImportPreview,
  ImportResult,
  JournalPreviewSummary,
  JournalTradePreview,
} from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtSignedMoney } from "@/lib/format";
import {
  effectiveOptionRight,
  mergeOptionOverrides,
  type OptionRightOverride,
} from "@/lib/importOptionRight";
import { tradeDetailFromJournalPreview } from "@/lib/importTradePreview";
import { intlLocale } from "@/lib/locale";
import { useUI } from "@/lib/ui";

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

/** True when a JSON backup embeds an account name (nested or legacy flat). */
export function jsonFileHasAccountName(text: string): string | null {
  try {
    const data = JSON.parse(text) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const root = data as Record<string, unknown>;
    const nested = root.account;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const name = String((nested as { name?: unknown }).name ?? "").trim();
      if (name) return name;
    }
    const flat = String(root.account_name ?? "").trim();
    return flat || null;
  } catch {
    return null;
  }
}

async function readJSONAccountName(file: File): Promise<string | null> {
  if (!file.name.toLowerCase().endsWith(".json")) return null;
  try {
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("read failed"));
      reader.readAsText(file);
    });
    return jsonFileHasAccountName(text);
  } catch {
    return null;
  }
}

function ImportGuidance({ onLogTrade }: { onLogTrade?: () => void }) {
  return (
    <aside className="flex flex-col gap-4 rounded-md border border-border bg-background p-4 lg:sticky lg:top-4">
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-chart-3">
          Supported formats
        </h2>
        <ul className="mt-3 flex flex-col gap-2.5 text-[12px] leading-relaxed text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Fill CSV</span> — broker execution
            exports; map a Market/Asset Type column for mixed stock/option files, or we infer from
            the symbol.
          </li>
          <li>
            <span className="font-medium text-foreground">Journal export</span> — closed trades with
            Entry/Exit columns; setup and tags preserved.
          </li>
          <li>
            <span className="font-medium text-foreground">JSON export</span> — full account backup
            with trades, fills, tags, cash, and the playbook setups catalog; re-import on this page.
          </li>
        </ul>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Export
        </h3>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Switch to Export to download JSON, CSV, or ZIP (JSON + screenshots). Re-import JSON/CSV on
          Import.
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Sample file
        </h3>
        <div className="mt-2 flex flex-col gap-2">
          <a
            href="/sample-fill-import.csv"
            download="sample-fill-import.csv"
            className="inline-flex items-center gap-1.5 text-[11px] text-primary no-underline transition-opacity hover:opacity-80"
          >
            <FileText size={12} strokeWidth={1.75} />
            Download sample CSV
          </a>
          <a
            href="/sample-json-import.json"
            download="sample-json-import.json"
            className="inline-flex items-center gap-1.5 text-[11px] text-primary no-underline transition-opacity hover:opacity-80"
          >
            <FileJson size={12} strokeWidth={1.75} />
            Download sample JSON
          </a>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Your CSV stays on your server. Nothing is sent to third parties.
        </p>
      </div>

      {onLogTrade ? (
        <div className="border-t border-border pt-4">
          <Button
            type="button"
            variant="link"
            onClick={onLogTrade}
            className="h-auto text-[11px] text-muted-foreground hover:text-foreground"
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
  const [jsonAccountName, setJsonAccountName] = useState<string | null>(null);

  useEffect(() => {
    if (accounts.length === 0) return;
    setAccountId((prev) => {
      if (prev && accounts.some((account) => account.id === prev)) return prev;
      return resolveImportAccountId(accounts, defaultAccountId);
    });
  }, [accounts, defaultAccountId]);

  const effectiveAccountId = resolveImportAccountId(accounts, accountId || defaultAccountId);
  const isJsonFile = !!file && file.name.toLowerCase().endsWith(".json");
  // JSON backups can create/match an account from embedded metadata — no select required.
  const canBypassAccount = Boolean(jsonAccountName) || (isJsonFile && accounts.length === 0);
  const canSubmit =
    !!file && !loading && (canBypassAccount || (accounts.length > 0 && !!effectiveAccountId));

  async function handleFileChange(next: File | null) {
    setFile(next);
    if (!next) {
      setJsonAccountName(null);
      return;
    }
    setJsonAccountName(await readJSONAccountName(next));
  }

  async function handleSubmit() {
    if (!file) return;
    if (!canBypassAccount && !effectiveAccountId) return;
    await onPreview(file, canBypassAccount && !effectiveAccountId ? "" : effectiveAccountId);
  }

  return (
    <Panel title="Upload file" className="rounded-none border-0 lg:border lg:rounded-md">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {accountsLoading ? (
          <Skeleton height="36px" />
        ) : canBypassAccount && accounts.length === 0 ? (
          <Field
            label="Account"
            description={
              jsonAccountName
                ? `Will create “${jsonAccountName}” from the JSON file on confirm.`
                : "Will create or match an account from the JSON file on confirm."
            }
          >
            <p className="rounded-md border border-border bg-muted px-3 py-2.5 text-[13px] text-foreground">
              {jsonAccountName ?? "From JSON backup"}
            </p>
          </Field>
        ) : (
          <Field
            label="Account"
            description={
              canBypassAccount
                ? `JSON includes “${jsonAccountName}” — select an account to override, or leave the default.`
                : undefined
            }
          >
            <NativeSelect
              value={effectiveAccountId}
              onChange={(event) => setAccountId(event.target.value)}
              aria-label="Account select"
              wrapperClassName="w-full"
            >
              {accounts.length === 0 ? (
                <NativeSelectOption value="" disabled>
                  No accounts — create one in Settings
                </NativeSelectOption>
              ) : (
                accounts.map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.name}
                  </NativeSelectOption>
                ))
              )}
            </NativeSelect>
          </Field>
        )}

        <Field
          label="File"
          description={
            file
              ? undefined
              : "Select a CSV or JSON file to enable Preview. JSON backups with an account can skip creating one first."
          }
        >
          <CsvDropZone
            file={file}
            onFileChange={(f) => void handleFileChange(f)}
            disabled={loading}
          />
        </Field>

        {error && <p className="text-[11px] text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="button"
            variant="default"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {loading ? (
              <>
                <RefreshCw size={13} strokeWidth={1.5} className="animate-spin" />
                Processing…
              </>
            ) : (
              <>
                Preview import
                <ArrowRight size={13} strokeWidth={1.5} />
              </>
            )}
          </Button>
          {file && !canSubmit && !canBypassAccount && accounts.length === 0 && (
            <span className="text-[10px] text-muted-foreground">
              Create an account in Settings, or upload a JSON backup that includes account details
            </span>
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
  const pnlTone = summary.net_pnl >= 0 ? "text-profit" : "text-destructive";

  const cells: { label: string; value: string; sub?: string; valueClass?: string }[] = [
    {
      label: "Trades",
      value: String(summary.trade_count),
      sub: "round-trips",
    },
    {
      label: "Markets",
      value: `${summary.stock_trades} / ${summary.option_trades}`,
      sub: "stk / opt",
      valueClass: "text-primary",
    },
    {
      label: "Fills",
      value: String(summary.execution_count),
      sub: "executions",
    },
    {
      label: "Est. net P&L",
      value: netPnl,
      valueClass: pnlTone,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.label} className="flex min-h-19 flex-col rounded-md bg-muted px-3 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {cell.label}
            </span>
            <div className="mt-auto flex flex-wrap items-baseline gap-1.5 pt-2">
              <span
                className={cn(
                  "text-[18px] font-semibold leading-none tabular-nums",
                  cell.valueClass ?? "text-foreground",
                )}
              >
                {cell.value}
              </span>
              {cell.sub ? (
                <span className="text-[11px] tabular-nums text-muted-foreground">{cell.sub}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {summary.error_count > 0 ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {summary.error_count} row(s) could not be parsed — they will be skipped on import.
        </p>
      ) : null}
    </div>
  );
}

function JournalTradePreviewTable({
  trades,
  currency,
  accountId,
  optionOverrides,
  onOptionRightChange,
}: {
  trades: JournalTradePreview[];
  currency: string;
  accountId: string;
  optionOverrides: Record<number, OptionRightOverride>;
  onOptionRightChange: (row: number, right: OptionRightOverride) => void;
}) {
  const openImportTradePreview = useUI((s) => s.openImportTradePreview);
  const displayTrades = useMemo(
    () => mergeOptionOverrides(trades, optionOverrides),
    [trades, optionOverrides],
  );

  const columns = useMemo(
    () =>
      journalTradePreviewColumns(
        currency,
        (trade) => {
          const detail = tradeDetailFromJournalPreview(trade, {
            accountId: accountId || "pending",
            optionRight: effectiveOptionRight(trade, optionOverrides),
            currency,
          });
          openImportTradePreview(detail, (optionRight) => {
            if (optionRight === "call" || optionRight === "put") {
              onOptionRightChange(trade.row, optionRight);
            }
          });
        },
        optionOverrides,
      ),
    [currency, accountId, optionOverrides, onOptionRightChange, openImportTradePreview],
  );

  return <DataTable columns={columns} data={displayTrades} dense maxHeight="min(60vh, 520px)" />;
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
  accountId: string;
  onCommit: (
    mapping: Record<string, string>,
    optionOverrides?: Record<number, OptionRightOverride>,
  ) => Promise<void>;
  onBack: () => void;
  error: string | null;
  loading: boolean;
}

function Step2Map({ preview, currency, accountId, onCommit, onBack, error, loading }: Step2Props) {
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
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        disabled={loading}
        className="h-auto w-fit gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-muted-foreground"
      >
        <ArrowLeft size={12} strokeWidth={1.75} />
        Back
      </Button>

      <Panel
        title={skipMapping ? (isJournal ? "Review journal" : "Review import ") : "Map columns"}
      >
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          {isJournal ? (
            <div className="flex flex-col gap-4">
              <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
                Closed-trade journal export — each row becomes one round-trip (2 fills). Setup,
                tags, and journal fields apply automatically. Dir shows side and call/put when
                present; use <span className="font-medium text-foreground">Edit</span> to fill gaps.
              </p>
              {preview.journal_summary ? (
                <JournalSummaryStrip summary={preview.journal_summary} currency={currency} />
              ) : null}
            </div>
          ) : skipMapping ? (
            <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
              TraderMemos JSON execution export — fills import directly, no column mapping needed.
            </p>
          ) : (
            <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
              Match each field to a CSV column. Instrument type is optional — map Market/Asset Type
              for mixed files, or skip to infer from each symbol.
            </p>
          )}

          {!skipMapping && (
            <div className="flex max-w-lg flex-col gap-3">
              {CANONICAL_FIELDS.map((field) => (
                <Field key={field} label={field.replace(/_/g, " ")}>
                  <OptionsSelect
                    value={mapping[field] ?? ""}
                    onValueChange={(v) => setField(field, v)}
                    ariaLabel={`Map ${field}`}
                    options={[
                      { value: "", label: "(skip)" },
                      ...preview.headers.map((h) => ({ value: h, label: h })),
                    ]}
                    triggerClassName="h-8 text-[12px]"
                  />
                </Field>
              ))}
            </div>
          )}

          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}

          {preview.pending_account ? (
            <p className="m-0 rounded-md bg-muted px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
              Account{" "}
              <span className="font-medium text-foreground">“{preview.pending_account.name}”</span>
              {preview.pending_account.broker ? ` · ${preview.pending_account.broker}` : ""} will be
              created when you confirm.
            </p>
          ) : null}
        </div>
      </Panel>

      {isJournal && preview.sample_trades && preview.sample_trades.length > 0 ? (
        <Panel
          title={`Trade preview (${preview.journal_summary?.trade_count ?? preview.sample_trades.length})`}
        >
          <JournalTradePreviewTable
            trades={preview.sample_trades}
            currency={currency}
            accountId={accountId}
            optionOverrides={optionOverrides}
            onOptionRightChange={setOptionRight}
          />
        </Panel>
      ) : (
        <Panel title="Sample Rows">
          <CsvSamplePreviewTable headers={preview.headers} rows={preview.sample_rows} />
        </Panel>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          type="button"
          variant="default"
          onClick={() => void handleCommit()}
          disabled={loading}
        >
          {loading ? (
            <>
              <RefreshCw size={13} strokeWidth={1.5} className="animate-spin" />
              Importing…
            </>
          ) : (
            "Confirm import "
          )}
        </Button>
      </div>
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
            <span className="text-[13px] font-semibold text-foreground">Import finished</span>
          </div>

          <div className="rounded-md border border-border bg-muted px-4 py-3">
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
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3.5 py-2.5">
              <p className="mb-1.5 text-[11px] font-semibold text-destructive">Row errors</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-[11px] text-destructive">
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
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums font-semibold",
          highlight === "pos" && "text-pos",
          highlight === "neg" && "text-destructive",
          !highlight && "text-foreground",
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
  const [omitAccount, setOmitAccount] = useState(false);
  const [omitInfoOpen, setOmitInfoOpen] = useState(false);
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
  const showOmitAccount = format === "json" || format === "zip";

  async function handleExport() {
    if (!effectiveAccountId) return;
    setLoading(true);
    setError(null);
    try {
      await downloadExport({
        format,
        accountId: effectiveAccountId,
        omitAccount: showOmitAccount && omitAccount,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const formatHint =
    format === "csv"
      ? "Journal spreadsheet of closed trades — same account data as JSON, spreadsheet-friendly encoding."
      : format === "zip"
        ? omitAccount
          ? "ZIP without account identity — pick an account again on re-import."
          : "Full backup zip: export.json plus trade screenshots under attachments/."
        : omitAccount
          ? "Trade data only — re-import requires selecting or creating an account."
          : "Canonical backup: trades, fills, journal, cash, and playbook setups.";

  return (
    <Panel title="Export account" className="rounded-none border-0 lg:border lg:rounded-md">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {accountsLoading ? (
          <Skeleton height="36px" />
        ) : (
          <Field label="Account">
            <NativeSelect
              value={effectiveAccountId}
              onChange={(event) => setAccountId(event.target.value)}
              aria-label="Export account select"
              wrapperClassName="w-full"
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
          </Field>
        )}

        {showOmitAccount ? (
          <div className="flex items-center gap-1">
            <ToneToggle
              pressed={omitAccount}
              onPressedChange={setOmitAccount}
              variant="outline"
              size="sm"
              tone="accent"
              aria-label="Omit account details"
            >
              Omit account
            </ToneToggle>
            <ControlledPopover
              open={omitInfoOpen}
              onOpenChange={setOmitInfoOpen}
              align="start"
              triggerAriaLabel="About omit account"
              triggerClassName={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "text-muted-foreground hover:text-foreground",
                omitInfoOpen && "bg-accent text-foreground",
              )}
              className="max-w-[17rem] p-3"
              trigger={<Info size={14} strokeWidth={1.75} aria-hidden />}
            >
              <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-chart-3">
                Omit account
              </p>
              <p className="mt-2 m-0 text-[12px] leading-relaxed text-muted-foreground">
                Strips account name, broker, and IDs from the export — including on trades and
                fills. Use this for portable trade data; re-import requires selecting or creating an
                account.
              </p>
            </ControlledPopover>
          </div>
        ) : null}

        <Field label="Format">
          <SegmentedControl
            ariaLabel="Export format"
            value={format}
            onChange={(v) => setFormat(v as ExportFormat)}
            options={[
              { value: "json", label: "JSON" },
              { value: "csv", label: "CSV" },
              { value: "zip", label: "ZIP" },
            ]}
          />
        </Field>

        <p className="text-[11px] leading-relaxed text-muted-foreground">{formatHint}</p>

        {error ? <p className="text-[11px] text-destructive">{error}</p> : null}

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
    preview?.pending_account?.base_currency ||
    accounts.find((a) => a.id === stagedAccountId)?.base_currency ||
    accounts.find((a) => a.id === defaultAccountId)?.base_currency ||
    accounts[0]?.base_currency ||
    "USD";

  async function handlePreview(file: File, accountId: string) {
    setLoading(true);
    setStepError(null);
    setStagedFile(file);
    setStagedAccountId(accountId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (accountId) fd.append("account_id", accountId);
      const data = await onPreview(fd);
      if (data.account_id) setStagedAccountId(data.account_id);
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
      // Confirm is the only write — always use fresh commit (no preview batch).
      if (stagedAccountId) fd.append("account_id", stagedAccountId);
      if (preview.format === "journal_trades" && Object.keys(optionOverrides).length > 0) {
        fd.append("journal_option_overrides", JSON.stringify(optionOverrides));
      }
      const data = await onCommit("", fd);
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
              className="mb-2 h-auto gap-1 px-0 text-[11px] text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
            >
              <ArrowLeft size={12} strokeWidth={1.75} />
              Back to dashboard
            </Button>
          )}
          <h1 className="text-[15px] font-semibold tracking-tight text-foreground">
            Import & export
          </h1>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted-foreground">
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
                accountId={stagedAccountId || preview.account_id || ""}
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
