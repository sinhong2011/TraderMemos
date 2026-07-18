import { useForm, useStore } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { CircleDashed, FileStack, Loader2, Plus, ScanLine, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../../components/Drawer";
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/Collapsible";
import { GradeControl } from "../../components/GradeControl";
import { ModalBanner } from "../../components/Modal";
import { OcrSetupPromptModal, ocrScanButtonClass } from "../../components/OcrSetupPromptModal";
import { OcrSymbolGroupList } from "../../components/OcrSymbolGroupList";
import { Pill } from "../../components/Pill";
import { SegmentedControl } from "../../components/SegmentedControl";
import { SignalDatePicker } from "../../components/SignalDatePicker";
import { SignalDateTimePicker } from "../../components/SignalDateTimePicker";
import { SignalField, fieldError } from "../../components/SignalField";
import { SignalAmountInput } from "../../components/SignalAmountInput";
import { SignalInput, SignalTextarea } from "../../components/SignalInput";
import { SignalSelect } from "../../components/SignalSelect";
import { SignalPopover } from "../../components/SignalPopover";
import { signalInputClass } from "../../components/signal-field-styles";
import {
  fileToScreenshotItem,
  JournalScreenshotUpload,
} from "../../components/JournalScreenshotUpload";
import { BatchTradeResultPreview, TradeResultPreview } from "../../components/TradeResultPreview";
import { useToastManager } from "../../components/Toast";
import { Button } from "../../components/ui/button";
import { ApiError } from "../../lib/api/client";
import { attachmentsApi } from "../../lib/api/attachments";
import { cashApi } from "../../lib/api/cash";
import type { TradeExtract } from "../../lib/api/ocr";
import { tradesApi } from "../../lib/api/trades";
import { parseAmountToNumber } from "../../lib/amountInput";
import { cn } from "../../lib/cn";
import { usePrivacyMode } from "../../lib/displayPrefs";
import { fmtMoney, fmtSignedMoney } from "../../lib/format";
import { useFilters } from "../../lib/filters";
import {
  CUSTOM_PRESET_ID,
  FUTURES_PRESETS,
  multiplierForPreset,
  presetIdForSymbol,
} from "../../lib/futuresPresets";
import { capScreenshots, useJournalPrefs } from "../../lib/journalPrefs";
import {
  buildStructuredJournalNotes,
  computeInitialRisk,
  parseJournalNotes,
  weightedAvgEntry,
} from "../../lib/newTradeJournal";
import {
  defaultNewTradeFormValues,
  emptyExecutionRow,
  emptySymbolTrade,
  validateNonNegativeAmount,
  validatePositiveAmount,
  validateSymbolTrades,
  type ExecutionRow,
  type SymbolTradeBlock,
} from "../../lib/newTradeFormSchema";
import {
  flattenSymbolTradesToExecutions,
  rowsFromOcrExtract,
  tradesFromOcrExtract,
} from "../../lib/newTradeBlocks";
import { detectOptionStrategy } from "../../lib/optionStrategy";
import { groupOcrBySymbol, ocrScanToastDescription } from "../../lib/ocrSymbolGroups";
import { pnlColor } from "../../components/theme-tokens";
import {
  aggregateTradePnlPreviews,
  previewFillNetPnls,
  previewTradePnl,
} from "../../lib/tradePnlPreview";
import {
  EMOTIONAL_STATES,
  TRADE_SESSIONS,
  gradeFromInt,
  intFromGrade,
} from "../../lib/tradeGrades";
import { useAccounts } from "../../lib/hooks/useAccounts";
import { ExecutionBatchError, useCreateExecutions } from "../../lib/hooks/useExecutions";
import { useOcrParse } from "../../lib/hooks/useOcrParse";
import { useOcrSettings } from "../../lib/hooks/useOcrSettings";
import { isOcrVisionReady } from "../../lib/ocrVisionReady";
import { useSetups } from "../../lib/hooks/useSetups";
import { useTags } from "../../lib/hooks/useTags";
import { getIntlLocale, getStoredLocale } from "../../lib/locale";
import {
  listTradeTemplates,
  saveTradeTemplate,
  type TradeTemplate,
} from "../../lib/tradeTemplates";
import { useUI } from "../../lib/ui";

const MARKETS = [
  { value: "stock", label: "STOCK" },
  { value: "option", label: "OPTION" },
  { value: "crypto", label: "CRYPTO" },
  { value: "future", label: "FUTURES" },
  { value: "forex", label: "FOREX" },
];
const FILL_COLS = "72px minmax(120px,200px) 72px 80px 88px 72px 88px 1fr 32px";
const labelClass = "mb-1 block text-[10px] font-semibold uppercase tracking-widest text-text-muted";
export type Row = ExecutionRow;
export { rowsFromOcrExtract };

/** Infer the New Trade form API without exploding TanStack Form type params. */
function createNewTradeFormProbe() {
  return useForm({ defaultValues: defaultNewTradeFormValues() });
}
type NewTradeFormApi = ReturnType<typeof createNewTradeFormProbe>;

function num(value: string) {
  return parseAmountToNumber(value);
}

/** Per-fill notional (qty × price × multiplier) — same chip surface as amount inputs. */
function FillAmountCell({
  quantity,
  price,
  multiplier,
  currency,
  locale,
  emptyLabel,
}: {
  quantity: number;
  price: number;
  multiplier: number;
  currency: string;
  locale: string;
  emptyLabel?: string;
}) {
  const amount = quantity > 0 && price > 0 ? quantity * price * multiplier : null;
  const empty = amount == null;
  return (
    <span
      className={cn(
        signalInputClass,
        "inline-flex cursor-default items-center px-2 text-[12px] tabular-nums tracking-[-0.01em] hover:bg-bg-input",
        empty ? "justify-center text-text-dim" : "font-medium",
      )}
      aria-label={empty ? emptyLabel : undefined}
      title={empty ? undefined : "Qty × price × multiplier"}
    >
      {empty ? (
        <CircleDashed size={14} strokeWidth={1.75} aria-hidden />
      ) : (
        fmtMoney(amount, currency, locale)
      )}
    </span>
  );
}

/** Per-fill P&L — transparent surface; color carries the signal. */
function FillPnlCell({
  value,
  currency,
  locale,
  emptyLabel,
}: {
  value: number | null;
  currency: string;
  locale: string;
  emptyLabel?: string;
}) {
  const empty = value == null;
  return (
    <span
      className={cn(
        "inline-flex h-10 w-full items-center justify-center rounded-control px-2.5 text-[12px] tabular-nums tracking-[-0.01em]",
        empty ? "text-text-dim" : cn("font-medium", pnlColor(value)),
      )}
      aria-label={empty ? emptyLabel : undefined}
    >
      {empty ? (
        <CircleDashed size={14} strokeWidth={1.75} aria-hidden />
      ) : (
        fmtSignedMoney(value, currency, locale)
      )}
    </span>
  );
}

/** Collapsed-by-default Journal / Dividend section with motion. */
function CollapsibleSection({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={(next) => setOpen(next)} className="gap-3 pt-1">
      <CollapsibleTrigger className="w-full" aria-label={title}>
        <span className="text-[12px] font-bold uppercase tracking-widest text-text">{title}</span>
        {!open && summary ? (
          <span className="truncate text-[10px] text-text-muted">{summary}</span>
        ) : null}
        <CollapsibleChevron />
      </CollapsibleTrigger>
      <CollapsibleContent animation="height">
        <div className="flex flex-col gap-4 pt-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function blockMultiplier(block: SymbolTradeBlock) {
  return block.market === "future"
    ? multiplierForPreset(block.futuresPresetId)
    : num(block.multiplier) || (block.market === "option" ? 100 : 1);
}

function blockRisk(block: SymbolTradeBlock) {
  const parsed = block.rows.reduce<
    Array<{ side: "buy" | "sell"; quantity: number; price: number }>
  >((rows, row) => {
    const quantity = num(row.quantity);
    const price = num(row.price);
    if (quantity != null && price != null) rows.push({ side: row.side, quantity, price });
    return rows;
  }, []);
  const entry = weightedAvgEntry(parsed, block.side);
  if (!entry) return null;
  return computeInitialRisk(
    block.side,
    entry.avg,
    entry.qty,
    num(block.stop),
    blockMultiplier(block),
  );
}

function blockPnlPreview(block: SymbolTradeBlock) {
  const parsedRows = block.rows.map((r) => ({
    side: r.side,
    quantity: num(r.quantity) ?? 0,
    price: num(r.price) ?? 0,
    fees: num(r.fees) ?? 0,
    commission: num(r.commission) ?? 0,
  }));
  const risk = blockRisk(block);
  return {
    preview: previewTradePnl(block.side, parsedRows, blockMultiplier(block), risk),
    initialRisk: risk,
  };
}

function SymbolCard({
  form,
  block,
  index,
  currency,
  locale,
  removable,
  pending,
  setups,
  regularTags,
  mistakeTags,
  screenshotFiles,
  maxScreenshots,
  onAddScreenshots,
  onRemoveScreenshot,
}: {
  form: NewTradeFormApi;
  block: SymbolTradeBlock;
  index: number;
  currency: string;
  locale: string;
  removable: boolean;
  pending: boolean;
  setups: Array<{ id: string; name: string }>;
  regularTags: Array<{ id: string; name: string }>;
  mistakeTags: Array<{ id: string; name: string }>;
  screenshotFiles: File[];
  maxScreenshots: number | null;
  onAddScreenshots: (files: File[]) => void;
  onRemoveScreenshot: (fileIndex: number) => void;
}) {
  const base = `trades[${index}]` as const;
  const parsedRows = useMemo(
    () =>
      block.rows.map((r) => ({
        side: r.side,
        quantity: num(r.quantity) ?? 0,
        price: num(r.price) ?? 0,
        fees: num(r.fees) ?? 0,
        commission: num(r.commission) ?? 0,
      })),
    [block.rows],
  );
  const multiplier = blockMultiplier(block);
  const entry = useMemo(() => weightedAvgEntry(parsedRows, block.side), [parsedRows, block.side]);
  const risk = useMemo(
    () =>
      entry
        ? computeInitialRisk(block.side, entry.avg, entry.qty, num(block.stop), multiplier)
        : null,
    [entry, block.side, block.stop, multiplier],
  );
  const preview = useMemo(
    () => previewTradePnl(block.side, parsedRows, multiplier, risk),
    [block.side, parsedRows, multiplier, risk],
  );
  const fillPnls = useMemo(
    () => previewFillNetPnls(block.side, parsedRows, multiplier),
    [block.side, parsedRows, multiplier],
  );
  const optionStrategy = useMemo(
    () =>
      block.market === "option"
        ? detectOptionStrategy(block.side, [block.option_right || "call"])
        : null,
    [block.market, block.side, block.option_right],
  );
  const set = <K extends keyof SymbolTradeBlock>(key: K, value: SymbolTradeBlock[K]) =>
    form.setFieldValue(`${base}.${key}` as never, value as never);
  const syncContract = (
    next: Partial<Pick<SymbolTradeBlock, "option_right" | "option_strike" | "option_expiry">>,
  ) => {
    const right = next.option_right ?? block.option_right;
    const strike = next.option_strike ?? block.option_strike;
    const expiry = next.option_expiry ?? block.option_expiry;
    form.setFieldValue(
      `${base}.rows` as never,
      block.rows.map((r) => ({
        ...r,
        option_right: right === "put" || right === "call" ? right : r.option_right,
        strike,
        expiry,
      })) as never,
    );
  };
  const toggleSetupId = (id: string) => {
    const next = block.setupIds.includes(id)
      ? block.setupIds.filter((x) => x !== id)
      : [...block.setupIds, id];
    set("setupIds", next);
  };
  const toggleId = (ids: string[], id: string, field: "selectedTagIds" | "selectedMistakeIds") => {
    set(field, ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  };
  const suffix = index ? ` ${index + 1}` : "";
  const [open, setOpen] = useState(true);
  const collapsedSummary = [
    block.side.toUpperCase(),
    `${block.rows.length} fill${block.rows.length === 1 ? "" : "s"}`,
    preview.net != null ? fmtSignedMoney(preview.net, currency, locale) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => setOpen(next)}
      className="gap-4 rounded-control bg-bg-hover p-4"
      style={
        {
          "--color-bg-input": "var(--color-bg-elevated)",
          "--color-bg-input-hover": "var(--color-bg-panel)",
        } as CSSProperties
      }
      render={<section aria-label={`Symbol trade ${index + 1}`} />}
    >
      <div className="flex items-center gap-2">
        <CollapsibleTrigger
          className="min-w-0 flex-1 items-center gap-2.5"
          aria-label={`Toggle symbol ${index + 1}`}
        >
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-control bg-accent-bg text-[11px] font-semibold tabular-nums text-accent"
            aria-hidden
          >
            {index + 1}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
            <span className="truncate text-[15px] font-semibold leading-none tracking-[-0.02em] text-text">
              {block.symbol || "Untitled"}
            </span>
            <span className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-text-dim">
              {collapsedSummary && !open
                ? `Symbol ${index + 1} · ${collapsedSummary}`
                : `Symbol ${index + 1}`}
            </span>
          </span>
          <CollapsibleChevron />
        </CollapsibleTrigger>
        {removable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove symbol ${index + 1}`}
            disabled={pending}
            className="shrink-0 text-loss"
            onClick={() => {
              const next = (form.store.state.values.trades as SymbolTradeBlock[]).filter(
                (_: SymbolTradeBlock, i: number) => i !== index,
              );
              form.setFieldValue("trades", next.length ? next : [emptySymbolTrade()]);
            }}
          >
            <Trash2 size={14} />
          </Button>
        ) : null}
      </div>
      <CollapsibleContent animation="fade">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className={labelClass}>Market</label>
              <SignalSelect
                ariaLabel={`Market symbol ${index + 1}`}
                value={block.market}
                options={MARKETS}
                onValueChange={(market) => {
                  const next = market === "futures" ? "future" : market;
                  set("market", next);
                  if (next === "option") {
                    set("multiplier", "100");
                    if (!block.option_right) set("option_right", "call");
                  } else if (next === "future") {
                    set("futuresPresetId", presetIdForSymbol(block.symbol));
                    set("multiplier", String(multiplierForPreset(presetIdForSymbol(block.symbol))));
                  } else {
                    set("multiplier", "1");
                    set("option_right", "");
                    set("option_strike", "");
                    set("option_expiry", "");
                  }
                }}
                triggerClassName="h-9 text-[12px]"
              />
            </div>
            {block.market === "future" && (
              <div>
                <label className={labelClass}>Contract</label>
                <SignalSelect
                  ariaLabel={`Contract symbol ${index + 1}`}
                  value={block.futuresPresetId}
                  options={[
                    ...FUTURES_PRESETS.map((p) => ({ value: p.id, label: p.label })),
                    { value: CUSTOM_PRESET_ID, label: "Custom" },
                  ]}
                  onValueChange={(id) => {
                    set("futuresPresetId", id);
                    if (id !== CUSTOM_PRESET_ID)
                      set(
                        "symbol",
                        FUTURES_PRESETS.find((p) => p.id === id)?.symbol ?? block.symbol,
                      );
                  }}
                  triggerClassName="h-9 text-[12px]"
                />
              </div>
            )}
            <form.Field
              name={`${base}.symbol` as never}
              validators={{ onBlur: ({ value }) => (value ? undefined : "Symbol is required.") }}
            >
              {(field) => (
                <SignalField label="Symbol" error={fieldError(field.state.meta.errors)}>
                  <input
                    aria-label={`Symbol${suffix}`}
                    value={field.state.value as string}
                    onChange={(e) => {
                      field.handleChange(e.target.value.toUpperCase() as never);
                      if (block.market === "future")
                        set("futuresPresetId", presetIdForSymbol(e.target.value));
                    }}
                    onBlur={field.handleBlur}
                    placeholder="Ticker"
                    className="h-9 w-full rounded-control border border-border bg-bg-input px-3 text-[12px] text-text outline-none focus:border-accent"
                  />
                </SignalField>
              )}
            </form.Field>
            <div>
              <span className={labelClass}>Side</span>
              <SegmentedControl
                ariaLabel={`Side symbol ${index + 1}`}
                size="md"
                options={[
                  { value: "long", label: "↗ LONG" },
                  { value: "short", label: "↘ SHORT" },
                ]}
                tones={{ long: "pos", short: "neg" }}
                value={block.side}
                onChange={(side) => {
                  const next = side as "long" | "short";
                  set("side", next);
                  form.setFieldValue(
                    `${base}.rows` as never,
                    block.rows.map((r, row) =>
                      row === 0 ? { ...r, side: next === "long" ? "buy" : "sell" } : r,
                    ) as never,
                  );
                }}
              />
            </div>
          </div>
          {block.market === "option" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SignalField label="Multiplier">
                <SignalAmountInput
                  aria-label={`Multiplier symbol ${index + 1}`}
                  value={block.multiplier}
                  onValueChange={(v) => set("multiplier", v)}
                  placeholder="100"
                />
              </SignalField>
              <div>
                <span className={labelClass}>Right</span>
                <SegmentedControl
                  ariaLabel={`Option right symbol ${index + 1}`}
                  size="md"
                  options={[
                    { value: "call", label: "CALL" },
                    { value: "put", label: "PUT" },
                  ]}
                  tones={{ call: "pos", put: "neg" }}
                  value={block.option_right === "put" ? "put" : "call"}
                  onChange={(v) => {
                    const right = v === "put" ? "put" : "call";
                    set("option_right", right);
                    syncContract({ option_right: right });
                  }}
                />
              </div>
              <SignalField label="Strike">
                <SignalAmountInput
                  aria-label={`Strike symbol ${index + 1}`}
                  value={block.option_strike}
                  onValueChange={(v) => {
                    set("option_strike", v);
                    syncContract({ option_strike: v });
                  }}
                  placeholder="325"
                />
              </SignalField>
              <div>
                <span className={labelClass}>Expiry</span>
                <SignalDatePicker
                  aria-label={`Expiry symbol ${index + 1}`}
                  value={block.option_expiry}
                  onChange={(v) => {
                    set("option_expiry", v);
                    syncContract({ option_expiry: v });
                  }}
                />
              </div>
              {optionStrategy && (
                <p className="col-span-full text-[11px] text-text-muted">
                  {optionStrategy.label} · {optionStrategy.biasLabel}
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <SignalField label="Target">
              <SignalAmountInput
                aria-label={`Target symbol ${index + 1}`}
                value={block.target}
                onValueChange={(v) => set("target", v)}
                placeholder="Optional"
              />
            </SignalField>
            <SignalField label="Stop">
              <SignalAmountInput
                aria-label={`Stop symbol ${index + 1}`}
                value={block.stop}
                onValueChange={(v) => set("stop", v)}
                placeholder="Optional"
              />
            </SignalField>
          </div>
          <form.Field name={`${base}.rows` as never} mode="array">
            {(rowsField) => (
              <div className="flex flex-col gap-2">
                <span className={labelClass}>
                  {block.symbol ? `Executions · ${block.symbol}` : "Executions"}
                </span>
                <div
                  className="grid gap-2 text-[10px] font-medium uppercase tracking-widest text-text-muted"
                  style={{ gridTemplateColumns: FILL_COLS }}
                >
                  <span>Action</span>
                  <span>Date / Time</span>
                  <span>Qty</span>
                  <span>Price</span>
                  <span>Amount</span>
                  <span>Fee</span>
                  <span>P&L</span>
                  <span />
                  <span />
                </div>
                {block.rows.map((row, rowIndex) => (
                  <div
                    key={`${block.key}-${rowIndex}`}
                    className="grid items-start gap-2"
                    style={{ gridTemplateColumns: FILL_COLS }}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      aria-label={`Toggle action symbol ${index + 1} row ${rowIndex + 1}`}
                      onClick={() =>
                        form.setFieldValue(
                          `${base}.rows[${rowIndex}].side` as never,
                          (row.side === "buy" ? "sell" : "buy") as never,
                        )
                      }
                      className={cn(
                        "font-bold hover:bg-transparent",
                        row.side === "buy" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
                      )}
                    >
                      {row.side.toUpperCase()}
                    </Button>
                    <form.Field name={`${base}.rows[${rowIndex}].executed_at` as never}>
                      {(field) => (
                        <SignalDateTimePicker
                          aria-label={`Date/time symbol ${index + 1} row ${rowIndex + 1}`}
                          value={field.state.value as string}
                          onChange={(v) => field.handleChange(v as never)}
                        />
                      )}
                    </form.Field>
                    <form.Field
                      name={`${base}.rows[${rowIndex}].quantity` as never}
                      validators={{
                        onBlur: ({ value }) => validatePositiveAmount(value as string, "Qty"),
                      }}
                    >
                      {(field) => (
                        <SignalAmountInput
                          aria-label={`Qty${index ? ` symbol ${index + 1}` : ""} row ${rowIndex + 1}`}
                          value={field.state.value as string}
                          onValueChange={(v) => field.handleChange(v as never)}
                          placeholder="Qty"
                        />
                      )}
                    </form.Field>
                    <form.Field
                      name={`${base}.rows[${rowIndex}].price` as never}
                      validators={{
                        onBlur: ({ value }) => validatePositiveAmount(value as string, "Price"),
                      }}
                    >
                      {(field) => (
                        <SignalAmountInput
                          aria-label={`Price${index ? ` symbol ${index + 1}` : ""} row ${rowIndex + 1}`}
                          value={field.state.value as string}
                          onValueChange={(v) => field.handleChange(v as never)}
                          placeholder="Price"
                        />
                      )}
                    </form.Field>
                    <FillAmountCell
                      quantity={parsedRows[rowIndex]?.quantity ?? 0}
                      price={parsedRows[rowIndex]?.price ?? 0}
                      multiplier={multiplier}
                      currency={currency}
                      locale={locale}
                      emptyLabel={`Amount symbol ${index + 1} row ${rowIndex + 1}: empty`}
                    />
                    <form.Field
                      name={`${base}.rows[${rowIndex}].fees` as never}
                      validators={{
                        onBlur: ({ value }) => validateNonNegativeAmount(value as string, "Fee"),
                      }}
                    >
                      {(field) => (
                        <SignalAmountInput
                          aria-label={`Fee${index ? ` symbol ${index + 1}` : ""} row ${rowIndex + 1}`}
                          value={field.state.value as string}
                          onValueChange={(v) => field.handleChange(v as never)}
                          placeholder="Fee"
                          compact
                        />
                      )}
                    </form.Field>
                    <FillPnlCell
                      value={fillPnls[rowIndex]}
                      currency={currency}
                      locale={locale}
                      emptyLabel={`P&L symbol ${index + 1} row ${rowIndex + 1}: empty`}
                    />
                    <span aria-hidden />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove row symbol ${index + 1} row ${rowIndex + 1}`}
                      disabled={block.rows.length === 1}
                      onClick={() => rowsField.removeValue(rowIndex)}
                      className="justify-self-end"
                    >
                      <X size={12} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  aria-label={`Add execution row symbol ${index + 1}`}
                  onClick={() =>
                    rowsField.pushValue(
                      emptyExecutionRow(block.side === "long" ? "buy" : "sell", {
                        option_right: block.option_right,
                        strike: block.option_strike,
                        expiry: block.option_expiry,
                      }) as never,
                    )
                  }
                  className="mx-auto size-9"
                >
                  <Plus size={16} />
                </Button>
              </div>
            )}
          </form.Field>
          <TradeResultPreview
            preview={preview}
            currency={currency}
            locale={locale}
            initialRisk={risk}
          />

          <CollapsibleSection
            title="Journal"
            summary={
              [
                block.setupIds.length
                  ? `${block.setupIds.length} setup${block.setupIds.length === 1 ? "" : "s"}`
                  : "",
                block.session,
                block.emotionalState,
                screenshotFiles.length
                  ? `${screenshotFiles.length} shot${screenshotFiles.length === 1 ? "" : "s"}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ") || undefined
            }
          >
            <div>
              <span className={labelClass}>Setups (select multiple)</span>
              <p className="mb-2 text-[10px] text-text-muted">
                First selected setup becomes the main setup.
              </p>
              {setups.length === 0 ? (
                <p className="text-[11px] text-text-muted">
                  No setups yet — create some in Playbook.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {setups.map((s) => {
                    const idx = block.setupIds.indexOf(s.id);
                    const on = idx >= 0;
                    return (
                      <Button
                        key={s.id}
                        type="button"
                        variant="ghost"
                        onClick={() => toggleSetupId(s.id)}
                        className="h-auto border-none bg-transparent p-0 hover:bg-transparent"
                        aria-pressed={on}
                      >
                        <Pill tone={on ? "accent" : "muted"}>
                          {on && idx === 0 ? `${s.name} · main` : s.name}
                        </Pill>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <span className={labelClass}>Session</span>
              <div className="flex flex-wrap gap-1.5">
                {TRADE_SESSIONS.map((s) => {
                  const on = block.session === s;
                  return (
                    <Button
                      key={s}
                      type="button"
                      variant={on ? "soft" : "secondary"}
                      size="xs"
                      onClick={() => set("session", on ? "" : s)}
                      className="tracking-[0.02em]"
                    >
                      {s}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor={`nt-emotion-${block.key}`}>
                Emotion
              </label>
              <SignalSelect
                id={`nt-emotion-${block.key}`}
                value={block.emotionalState}
                onValueChange={(v) => set("emotionalState", v)}
                options={[
                  { value: "", label: "Not set" },
                  ...EMOTIONAL_STATES.map((s) => ({ value: s, label: s })),
                ]}
                ariaLabel={`Emotion${suffix}`}
                triggerClassName="h-9 text-[12px]"
              />
            </div>
            {regularTags.length > 0 && (
              <div>
                <span className={labelClass}>Tags</span>
                <div className="flex flex-wrap gap-1.5">
                  {regularTags.map((t) => {
                    const on = block.selectedTagIds.includes(t.id);
                    return (
                      <Button
                        key={t.id}
                        type="button"
                        variant="ghost"
                        onClick={() => toggleId(block.selectedTagIds, t.id, "selectedTagIds")}
                        className="h-auto border-none bg-transparent p-0 hover:bg-transparent"
                      >
                        <Pill tone={on ? "accent" : "muted"}>{t.name}</Pill>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
            {mistakeTags.length > 0 && (
              <div>
                <span className={labelClass}>Mistake type</span>
                <p className="mb-2 text-[10px] text-text-muted">Optional — tap any that apply.</p>
                <div className="flex flex-wrap gap-1.5">
                  {mistakeTags.map((t) => {
                    const on = block.selectedMistakeIds.includes(t.id);
                    return (
                      <Button
                        key={t.id}
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          toggleId(block.selectedMistakeIds, t.id, "selectedMistakeIds")
                        }
                        className="h-auto border-none bg-transparent p-0 hover:bg-transparent"
                      >
                        <Pill tone={on ? "neg" : "muted"}>{t.name}</Pill>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
            <GradeControl
              label="Setup rating"
              hint="Rate the setup itself — ignore PnL and emotion."
              value={block.setupGrade}
              onChange={(v) => set("setupGrade", v)}
            />
            <GradeControl
              label="Execution rating"
              hint="Rate your execution — patience, timing, stop discipline."
              value={block.executionGrade}
              onChange={(v) => set("executionGrade", v)}
            />
            <div>
              <label className={labelClass} htmlFor={`nt-entry-${block.key}`}>
                Entry reason
              </label>
              <SignalTextarea
                id={`nt-entry-${block.key}`}
                aria-label={`Entry reason${suffix}`}
                value={block.entryReason}
                onChange={(e) => set("entryReason", e.target.value)}
                rows={2}
                placeholder="Why did you enter?"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`nt-exit-${block.key}`}>
                Exit reason
              </label>
              <SignalTextarea
                id={`nt-exit-${block.key}`}
                aria-label={`Exit reason${suffix}`}
                value={block.exitReason}
                onChange={(e) => set("exitReason", e.target.value)}
                rows={2}
                placeholder="Why did you exit?"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`nt-review-${block.key}`}>
                Review notes
              </label>
              <SignalTextarea
                id={`nt-review-${block.key}`}
                aria-label={`Review notes${suffix}`}
                value={block.reviewNotes}
                onChange={(e) => set("reviewNotes", e.target.value)}
                rows={3}
                placeholder="What would you do differently?"
              />
            </div>
            <div>
              <span className={labelClass}>
                Screenshots
                {screenshotFiles.length > 0
                  ? maxScreenshots != null
                    ? ` (${screenshotFiles.length}/${maxScreenshots})`
                    : ` (${screenshotFiles.length})`
                  : maxScreenshots != null
                    ? ` (max ${maxScreenshots})`
                    : ""}
              </span>
              <JournalScreenshotUpload
                className="mt-1"
                inputTestId={`journal-screenshot-input-${index + 1}`}
                items={screenshotFiles.map((file, fileIndex) =>
                  fileToScreenshotItem(file, () => onRemoveScreenshot(fileIndex)),
                )}
                onAddFiles={onAddScreenshots}
                maxCount={maxScreenshots}
                disabled={pending}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Dividend"
            summary={
              block.dividendAmount.trim() ? `${block.dividendAmount} ${currency}` : undefined
            }
          >
            <p className="m-0 text-[10px] text-text-muted">
              Optional payout on this symbol. Amount rolls into trade P&amp;L (shorts as a debit).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <SignalField label={`Amount (${currency})`}>
                <SignalAmountInput
                  aria-label={`Dividend amount${suffix}`}
                  value={block.dividendAmount}
                  onValueChange={(v) => set("dividendAmount", v)}
                  placeholder="0.00"
                />
              </SignalField>
              <div>
                <span className={labelClass}>Date</span>
                <SignalDatePicker
                  aria-label={`Dividend date${suffix}`}
                  value={block.dividendDate}
                  onChange={(v) => set("dividendDate", v)}
                />
              </div>
            </div>
            <SignalField label="Note">
              <SignalInput
                aria-label={`Dividend note${suffix}`}
                value={block.dividendNote}
                onChange={(e) => set("dividendNote", e.target.value)}
                placeholder="Optional"
              />
            </SignalField>
          </CollapsibleSection>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function NewTradeDrawer() {
  usePrivacyMode();
  const navigate = useNavigate();
  const open = useUI((s) => s.modal === "new-trade");
  const closeModal = useUI((s) => s.closeModal);
  const filterAccountId = useFilters((s) => s.accountId);
  const accounts = useAccounts().data ?? [];
  const setups = useSetups().data ?? [];
  const allTags = useTags().data;
  const mistakeTags = useMemo(() => (allTags ?? []).filter((t) => t.kind === "mistake"), [allTags]);
  const regularTags = useMemo(() => (allTags ?? []).filter((t) => t.kind !== "mistake"), [allTags]);
  const createExecutions = useCreateExecutions();
  const ocrParse = useOcrParse();
  const { data: ocrSettings, isLoading: ocrSettingsLoading } = useOcrSettings();
  const visionReady = isOcrVisionReady(ocrSettings);
  const toast = useToastManager();
  const maxScreenshots = useJournalPrefs((s) => s.maxScreenshotsPerTrade);
  const [pendingFilesByKey, setPendingFilesByKey] = useState<Record<string, File[]>>({});
  const [ocrExtract, setOcrExtract] = useState<TradeExtract | null>(null);
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [ocrSetupPromptOpen, setOcrSetupPromptOpen] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [templates, setTemplates] = useState<TradeTemplate[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const ocrFileRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
  const locale = getIntlLocale(getStoredLocale());
  const defaultValuesRef = useRef(defaultNewTradeFormValues());
  const form = useForm({
    defaultValues: defaultValuesRef.current,
    onSubmit: async ({ value }) => {
      setSubmitError("");
      const accountId = value.accountId || filterAccountId || accounts[0]?.id || "";
      if (!accountId) {
        setSubmitError("Account is required.");
        return;
      }
      const tradesErr = validateSymbolTrades(value.trades);
      if (tradesErr) {
        setSubmitError(tradesErr);
        return;
      }
      const accountIds = [accountId, ...value.copyAccountIds.filter((id) => id !== accountId)];
      try {
        const rows = flattenSymbolTradesToExecutions(value.trades);
        if (rows.length === 0) {
          setSubmitError("Add at least one valid execution row.");
          return;
        }
        const { tradeIds, bySymbol } = await createExecutions.mutateAsync({ accountIds, rows });
        await Promise.all(
          value.trades.map(async (block) => {
            const id = bySymbol[block.symbol.trim().toUpperCase()];
            if (!id) return;
            await tradesApi.patch(id, {
              notes: buildStructuredJournalNotes({
                session: block.session,
                entryReason: block.entryReason,
                exitReason: block.exitReason,
                reviewNotes: block.reviewNotes,
              }),
              setup_id: block.setupIds[0] ?? "",
              setup_ids: block.setupIds,
              emotional_state: block.emotionalState || "",
              confidence: intFromGrade(block.setupGrade),
              trade_quality: intFromGrade(block.executionGrade),
              tag_ids: [...block.selectedTagIds, ...block.selectedMistakeIds],
              initial_risk: blockRisk(block) ?? undefined,
              target_price: num(block.target) ?? undefined,
              stop_price: num(block.stop) ?? undefined,
            });
            for (const file of capScreenshots(pendingFilesByKey[block.key] ?? [], maxScreenshots)) {
              const fd = new FormData();
              fd.append("file", file);
              await attachmentsApi.upload(id, fd);
            }
            const amount = num(block.dividendAmount);
            if (amount != null && amount > 0) {
              await cashApi.create({
                account_id: accountId,
                type: "dividend",
                amount: block.side === "short" ? -Math.abs(amount) : Math.abs(amount),
                currency: accounts.find((a) => a.id === accountId)?.base_currency ?? "USD",
                occurred_at: new Date(`${block.dividendDate}T12:00:00`).toISOString(),
                note:
                  block.dividendNote || `${block.symbol.trim().toUpperCase() || "Trade"} dividend`,
                trade_id: id,
              });
            }
          }),
        );
        toast.add({
          title: "Trades logged",
          description: `${Object.keys(bySymbol).length || tradeIds.length} symbol${(Object.keys(bySymbol).length || tradeIds.length) === 1 ? "" : "s"} saved.`,
        });
        close();
      } catch (error) {
        const message =
          error instanceof ExecutionBatchError
            ? error.failures
                .map((f) => `Row ${f.index + 1} (${f.accountId}): ${f.message}`)
                .join("; ")
            : error instanceof Error
              ? error.message
              : "Save failed";
        setSubmitError(message);
        toast.add({ title: "Could not log trades", description: message });
      }
    },
  });
  const values = useStore(form.store, (s) => s.values);
  const accountId = values.accountId || filterAccountId || accounts[0]?.id || "";
  const currency = accounts.find((a) => a.id === accountId)?.base_currency ?? "USD";
  const pending = createExecutions.isPending;
  const batchPreview = useMemo(
    () =>
      values.trades.length > 1
        ? aggregateTradePnlPreviews(values.trades.map(blockPnlPreview))
        : null,
    [values.trades],
  );
  const singleFooter = useMemo(() => {
    if (values.trades.length !== 1) return null;
    const result = blockPnlPreview(values.trades[0]!);
    return {
      preview: result.preview,
      risk: result.initialRisk,
    };
  }, [values.trades]);

  function reset() {
    form.reset(defaultNewTradeFormValues());
    setPendingFilesByKey({});
    setOcrExtract(null);
    setOcrWarnings([]);
    setSubmitError("");
    setTemplatesOpen(false);
    const acct = filterAccountId || accounts[0]?.id || "";
    if (acct) form.setFieldValue("accountId", acct);
  }

  function close() {
    reset();
    closeModal();
    setOcrSetupPromptOpen(false);
  }

  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (wasOpen.current) return;
    wasOpen.current = true;
    form.reset(defaultNewTradeFormValues());
    setPendingFilesByKey({});
    setOcrExtract(null);
    setOcrWarnings([]);
    setSubmitError("");
    setTemplates(listTradeTemplates());
    if (!filterAccountId && accounts[0]?.id) {
      form.setFieldValue("accountId", accounts[0].id);
    } else if (filterAccountId) {
      form.setFieldValue("accountId", filterAccountId);
    }
    const draft = useUI.getState().consumeTradeDraft();
    if (draft) {
      form.setFieldValue("trades", [
        emptySymbolTrade({
          symbol: draft.symbol,
          side: draft.side || "long",
          target: draft.target,
          stop: draft.stop,
          rows: [emptyExecutionRow(draft.side === "short" ? "sell" : "buy")],
          setupIds: draft.setupId ? [draft.setupId] : [],
        }),
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per drawer session
  }, [open]);

  const applyTemplate = (template: TradeTemplate) => {
    const journal = parseJournalNotes(template.notes);
    form.setFieldValue("trades", [
      emptySymbolTrade({
        market: template.market,
        symbol: template.symbol,
        side: template.side,
        target: template.target,
        stop: template.stop,
        multiplier: template.market === "option" ? "100" : "1",
        rows: template.rows.map((r) => ({ ...emptyExecutionRow(r.side), ...r })),
        setupIds: template.setupId ? [template.setupId] : [],
        session: journal.session,
        entryReason: journal.entryReason || journal.legacy,
        exitReason: journal.exitReason,
        reviewNotes: journal.reviewNotes,
        emotionalState: template.emotionalState,
        setupGrade: gradeFromInt(template.confidence),
        executionGrade: gradeFromInt(template.tradeQuality),
        selectedTagIds: template.tagIds,
        selectedMistakeIds: template.mistakeTagIds,
      }),
    ]);
    setTemplatesOpen(false);
  };

  const saveTemplate = () => {
    const name = window.prompt("Template name");
    const block = values.trades[0];
    if (!name?.trim() || !block) return;
    saveTradeTemplate({
      name: name.trim(),
      market: block.market,
      symbol: block.symbol,
      side: block.side,
      target: block.target,
      stop: block.stop,
      rows: block.rows.map(({ side, quantity, price, fees }) => ({ side, quantity, price, fees })),
      setupId: block.setupIds[0] ?? "",
      notes: buildStructuredJournalNotes({
        session: block.session,
        entryReason: block.entryReason,
        exitReason: block.exitReason,
        reviewNotes: block.reviewNotes,
      }),
      emotionalState: block.emotionalState,
      confidence: intFromGrade(block.setupGrade) ?? 3,
      tradeQuality: intFromGrade(block.executionGrade) ?? 3,
      tagIds: block.selectedTagIds,
      mistakeTagIds: block.selectedMistakeIds,
    });
    setTemplates(listTradeTemplates());
  };

  const scan = async (files: File | File[]) => {
    const list = Array.isArray(files) ? files : [files];
    if (list.length === 0) return;
    try {
      const extract = await ocrParse.mutateAsync(list);
      form.setFieldValue("trades", tradesFromOcrExtract(extract));
      setPendingFilesByKey({});
      setOcrExtract(extract);
      setOcrWarnings(extract.warnings ?? []);
      toast.add({
        title: list.length > 1 ? `Scanned ${list.length} images` : "Symbols loaded",
        description: ocrScanToastDescription(extract),
      });
    } catch (error) {
      toast.add({
        title: "OCR failed",
        description:
          error instanceof ApiError || error instanceof Error
            ? error.message
            : "Could not scan screenshot",
        type: "error",
      });
    }
  };

  const openVisionSettings = () => {
    close();
    void navigate({ to: "/settings" });
    window.location.hash = "general";
  };

  const onScanClick = () => {
    if (ocrSettingsLoading) return;
    if (!visionReady) {
      setOcrSetupPromptOpen(true);
      return;
    }
    ocrFileRef.current?.click();
  };

  return (
    <>
      <Drawer open={open} onOpenChange={(next) => !next && !pending && close()} modal>
        <DrawerContent
          style={
            {
              "--drawer-content-width": "min(860px, calc(100vw - 2 * var(--drawer-inset)))",
            } as CSSProperties
          }
        >
          <DrawerHeader>
            <DrawerTitle>New Trade</DrawerTitle>
            <div className="ml-auto flex items-center gap-0.5">
              <SignalPopover
                open={templatesOpen}
                onOpenChange={setTemplatesOpen}
                triggerAriaLabel="Templates"
                triggerClassName={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-control border-none bg-transparent px-2.5",
                  "text-[12px] font-medium text-text-muted transition-colors",
                  "hover:bg-bg-hover hover:text-text",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  templatesOpen && "bg-bg-hover text-text",
                )}
                trigger={
                  <>
                    <FileStack size={14} strokeWidth={1.75} aria-hidden />
                    Templates
                  </>
                }
              >
                <div className="min-w-48 bg-bg-elevated p-1">
                  {templates.map((t) => (
                    <Button
                      key={t.id}
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start px-3 py-2"
                      onClick={() => applyTemplate(t)}
                    >
                      {t.name}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-start px-3 py-2 text-accent"
                    onClick={saveTemplate}
                  >
                    Save first symbol as template…
                  </Button>
                </div>
              </SignalPopover>
              <DrawerClose
                aria-label="Close"
                className={cn(
                  "inline-flex size-8 cursor-pointer items-center justify-center rounded-control border-none bg-transparent",
                  "text-text-muted transition-colors hover:bg-bg-hover hover:text-text",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                )}
              >
                <X size={16} strokeWidth={1.5} />
              </DrawerClose>
            </div>
          </DrawerHeader>
          <DrawerBody>
            <ModalBanner>
              Add one or more symbols — each with fills, journal, and optional dividend. One Save
              logs every symbol as its own trade.
            </ModalBanner>
            <form
              className="mt-4 flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-48 flex-1">
                  <label className={labelClass}>Account</label>
                  <SignalSelect
                    ariaLabel="Account"
                    value={accountId}
                    options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                    onValueChange={(v) => form.setFieldValue("accountId", v)}
                    triggerClassName="text-[12px]"
                  />
                </div>
                <Button
                  type="button"
                  disabled={ocrParse.isPending || ocrSettingsLoading}
                  onClick={onScanClick}
                  className={ocrScanButtonClass(visionReady, ocrParse.isPending)}
                  aria-label="Prefill trade from screenshot"
                  title={
                    visionReady
                      ? "Select one or more screenshots"
                      : "Set up screenshot scan in Settings before scanning"
                  }
                >
                  {ocrParse.isPending ? (
                    <Loader2 size={14} strokeWidth={1.75} className="animate-spin" aria-hidden />
                  ) : (
                    <ScanLine size={14} aria-hidden />
                  )}
                  {ocrParse.isPending ? "Scanning…" : "Scan to fill"}
                </Button>
                <input
                  ref={ocrFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  data-testid="ocr-scan-input"
                  className="sr-only"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    if (files.length) void scan(files);
                  }}
                />
              </div>
              {accounts.filter((account) => account.id !== accountId).length > 0 && (
                <div>
                  <span className={labelClass}>Also save to</span>
                  <div className="flex flex-wrap gap-2">
                    {accounts
                      .filter((account) => account.id !== accountId)
                      .map((account) => (
                        <label
                          key={account.id}
                          className="flex cursor-pointer items-center gap-2 rounded-control bg-bg-input px-3 py-2 text-[12px] text-text-muted"
                        >
                          <input
                            type="checkbox"
                            checked={values.copyAccountIds.includes(account.id)}
                            onChange={() =>
                              form.setFieldValue(
                                "copyAccountIds",
                                values.copyAccountIds.includes(account.id)
                                  ? values.copyAccountIds.filter((id) => id !== account.id)
                                  : [...values.copyAccountIds, account.id],
                              )
                            }
                          />
                          {account.name}
                        </label>
                      ))}
                  </div>
                </div>
              )}
              {ocrExtract && (
                <div>
                  <span className={labelClass}>Symbols loaded from scan</span>
                  <OcrSymbolGroupList
                    groups={groupOcrBySymbol(ocrExtract)}
                    selected=""
                    logged={new Set()}
                    onSelect={() => {}}
                    readOnly
                  />
                </div>
              )}
              {ocrWarnings.length > 0 && (
                <ul className="text-[10px] text-text-muted" data-testid="ocr-warnings">
                  {ocrWarnings.map((warning) => (
                    <li
                      key={warning}
                      className={
                        /vision extract|commission|Trades tab|review fills|no usable fills/i.test(
                          warning,
                        )
                          ? "text-signal"
                          : undefined
                      }
                    >
                      · {warning}
                    </li>
                  ))}
                </ul>
              )}
              {values.trades.map((block, index) => (
                <SymbolCard
                  key={block.key}
                  form={form}
                  block={block}
                  index={index}
                  currency={currency}
                  locale={locale}
                  removable={values.trades.length > 1}
                  pending={pending}
                  setups={setups}
                  regularTags={regularTags}
                  mistakeTags={mistakeTags}
                  screenshotFiles={pendingFilesByKey[block.key] ?? []}
                  maxScreenshots={maxScreenshots}
                  onAddScreenshots={(incoming) =>
                    setPendingFilesByKey((prev) => ({
                      ...prev,
                      [block.key]: capScreenshots(
                        [...(prev[block.key] ?? []), ...incoming],
                        maxScreenshots,
                      ),
                    }))
                  }
                  onRemoveScreenshot={(fileIndex) =>
                    setPendingFilesByKey((prev) => ({
                      ...prev,
                      [block.key]: (prev[block.key] ?? []).filter((_, i) => i !== fileIndex),
                    }))
                  }
                />
              ))}
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => form.setFieldValue("trades", [...values.trades, emptySymbolTrade()])}
                disabled={pending}
                className="mx-auto gap-1.5"
              >
                <Plus size={15} />
                Add symbol
              </Button>
              {submitError && <p className="text-xs text-loss">{submitError}</p>}
            </form>
          </DrawerBody>
          <DrawerFooter>
            <div className="flex w-full flex-col gap-3">
              {batchPreview ? (
                <BatchTradeResultPreview batch={batchPreview} currency={currency} locale={locale} />
              ) : singleFooter ? (
                <TradeResultPreview
                  preview={singleFooter.preview}
                  currency={currency}
                  locale={locale}
                  initialRisk={singleFooter.risk}
                />
              ) : null}
              <div className="flex w-full justify-between gap-3">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="lg"
                    disabled={pending}
                    onClick={() => {
                      void form.handleSubmit();
                    }}
                  >
                    Save
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    disabled={pending}
                    onClick={reset}
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    disabled={pending}
                    onClick={close}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      <OcrSetupPromptModal
        open={ocrSetupPromptOpen}
        onOpenChange={setOcrSetupPromptOpen}
        settings={ocrSettings}
        onOpenSettings={openVisionSettings}
      />
    </>
  );
}
