import { Trans } from "@lingui/react/macro";
import { useForm, useStore } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDashed,
  FileStack,
  FileUp,
  Loader2,
  Plus,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/Drawer";
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/Collapsible";
import { GradeControl } from "@/components/GradeControl";
import { ModalBanner } from "@/components/Modal";
import { OcrSetupPromptModal } from "@/components/OcrSetupPromptModal";
import { OcrScanSummary } from "@/components/OcrSymbolGroupList";
import { SegmentedControl } from "@/components/SegmentedControl";
import { MultiSelectCombobox, type MultiSelectOption } from "@/components/MultiSelectCombobox";
import { DatePicker } from "@/components/DatePicker";
import { DateTimePicker } from "@/components/DateTimePicker";
import { Field, fieldError } from "@/components/Field";
import { AmountInput } from "@/components/AmountInput";
import { FormInput, FormTextarea } from "@/components/FormInput";
import { OptionsSelect } from "@/components/OptionsSelect";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ControlledPopover } from "@/components/ControlledPopover";
import { fieldInputClass } from "@/components/field-styles";
import {
  fileToScreenshotItem,
  JournalScreenshotUpload,
} from "@/components/JournalScreenshotUpload";
import {
  AfterSaveResultPreview,
  BatchTradeResultPreview,
  TradeResultPreview,
} from "@/components/TradeResultPreview";
import { useToastManager } from "@/components/Toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { attachmentsApi } from "@/lib/api/attachments";
import { cashApi } from "@/lib/api/cash";
import type { TradeExtract } from "@/lib/api/ocr";
import { tradesApi } from "@/lib/api/trades";
import { parseAmountToNumber } from "@/lib/amountInput";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { parseFillFile } from "@/lib/fillFile";
import { fmtMoney, fmtSignedMoney } from "@/lib/format";
import { soleAccountId, useFilters } from "@/lib/filters";
import {
  CUSTOM_PRESET_ID,
  FUTURES_PRESETS,
  multiplierForPreset,
  presetIdForSymbol,
} from "@/lib/futuresPresets";
import { capScreenshots, useJournalPrefs } from "@/lib/journalPrefs";
import {
  buildStructuredJournalNotes,
  computeInitialRisk,
  parseJournalNotes,
  weightedAvgEntry,
} from "@/lib/newTradeJournal";
import {
  defaultNewTradeFormValues,
  emptyExecutionRow,
  emptySymbolTrade,
  validateNonNegativeAmount,
  validatePositiveAmount,
  validateSymbolTrades,
  type ExecutionRow,
  type SymbolTradeBlock,
} from "@/lib/newTradeFormSchema";
import {
  flattenSymbolTradesToExecutions,
  rowsFromOcrExtract,
  symbolTradeFromDetail,
  tradesFromOcrExtract,
} from "@/lib/newTradeBlocks";
import { detectOptionStrategy } from "@/lib/optionStrategy";
import { groupOcrBySymbol, ocrScanToastDescription } from "@/lib/ocrSymbolGroups";
import { pnlColor } from "@/components/theme-tokens";
import {
  aggregateTradePnlPreviews,
  previewFillNetPnls,
  previewTradePnl,
} from "@/lib/tradePnlPreview";
import {
  EMOTIONAL_STATES,
  TRADE_SESSIONS,
  gradeFromInt,
  intFromGrade,
  joinEmotionalStates,
  parseEmotionalStates,
} from "@/lib/tradeGrades";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useSummary } from "@/lib/hooks/useAnalytics";
import { useCash } from "@/lib/hooks/useCash";
import {
  ExecutionBatchError,
  useCreateExecutions,
  useDeleteExecution,
  useUpdateExecution,
} from "@/lib/hooks/useExecutions";
import { useOcrParse } from "@/lib/hooks/useOcrParse";
import { useOcrSettings } from "@/lib/hooks/useOcrSettings";
import { isOcrVisionReady } from "@/lib/ocrVisionReady";
import { useSetups } from "@/lib/hooks/useSetups";
import { useTags } from "@/lib/hooks/useTags";
import { useTradeDetail } from "@/lib/hooks/useTradeDetail";
import { computeHeaderStats } from "@/lib/headerStats";
import { getIntlLocale, getStoredLocale } from "@/lib/locale";
import { listTradeTemplates, saveTradeTemplate, type TradeTemplate } from "@/lib/tradeTemplates";
import { isImportPreviewEditId } from "@/lib/importTradePreview";
import { useUI } from "@/lib/ui";

const MARKETS = [
  { value: "stock", label: "STOCK" },
  { value: "option", label: "OPTION" },
  { value: "crypto", label: "CRYPTO" },
  { value: "future", label: "FUTURES" },
  { value: "forex", label: "FOREX" },
];
const EMOTION_OPTIONS: MultiSelectOption[] = EMOTIONAL_STATES.map((s) => ({ value: s, label: s }));
/**
 * Fill rows become a table only once the card can show every column in full —
 * 46rem is where Date / Time (the one flexible track) still fits a whole
 * timestamp. Below that they stack into a 2-up block with per-cell labels. The
 * switch is driven by the card's own width (`@container/symbol`), not the
 * viewport: the drawer caps at 860px however wide the window gets.
 */
const FILL_TABLE_COLS =
  "@min-[46rem]/symbol:grid-cols-[72px_minmax(150px,1fr)_72px_80px_88px_72px_88px_32px]";
const labelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground";
/**
 * Field type scale for this drawer — 13px instead of the 16px the coss controls
 * use below `sm`, so a narrow drawer reads at one size. Coarse pointers keep 16px
 * so iOS Safari doesn't zoom the page on focus.
 */
const fieldTextClass = "text-[13px] pointer-coarse:text-base";
export type Row = ExecutionRow;
export { rowsFromOcrExtract };

/** Label + optional hint + a control — one shape for every journal taxonomy. */
function JournalField({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {htmlFor ? (
        <label className={labelClass} htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className={labelClass}>{label}</span>
      )}
      {hint ? <p className="mb-2 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}

/** Infer the New Trade form API without exploding TanStack Form type params. */
function createNewTradeFormProbe() {
  return useForm({ formId: "new-trade-probe", defaultValues: defaultNewTradeFormValues() });
}
type NewTradeFormApi = ReturnType<typeof createNewTradeFormProbe>;

function num(value: string) {
  return parseAmountToNumber(value);
}

/**
 * One cell of a fill row. Carries its own label while the row is stacked; the
 * shared header row takes over once the card is wide enough for table mode.
 */
function FillCell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span
        aria-hidden
        className="truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground @min-[46rem]/symbol:hidden"
      >
        {label}
      </span>
      {children}
    </div>
  );
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
        fieldInputClass,
        "inline-flex cursor-default items-center px-2 text-[12px] tabular-nums tracking-[-0.01em]",
        empty ? "justify-center text-muted-foreground" : "font-medium",
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
        "inline-flex h-8.5 w-full items-center justify-center rounded-lg px-2.5 text-[12px] tabular-nums tracking-[-0.01em] sm:h-7.5",
        empty ? "text-muted-foreground" : cn("font-medium", pnlColor(value)),
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

/** Nested panels matching coss Input / Card field chrome. */
const cossPanelClass = cn(
  "relative overflow-hidden rounded-lg border border-input bg-background not-dark:bg-clip-padding shadow-xs/5",
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)]",
  "before:shadow-[0_1px_--theme(--color-black/4%)]",
  "dark:bg-input/32 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
);

const FILL_ACTION_SPRING = {
  type: "spring" as const,
  stiffness: 520,
  damping: 34,
  mass: 0.7,
};

/** Softer than the fill toggle — a card is a large surface, so it settles slower. */
/** Snappier than the symbol card — a fill row is a smaller thing to move. */
const FILL_ROW_SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 34,
  mass: 0.8,
};

const SYMBOL_CARD_SPRING = {
  type: "spring" as const,
  stiffness: 340,
  damping: 32,
  mass: 0.9,
};

/** Buy / Sell fill toggle — directional swap motion on change. */
function FillActionToggle({
  side,
  onToggle,
  "aria-label": ariaLabel,
}: {
  side: "buy" | "sell";
  onToggle: () => void;
  "aria-label": string;
}) {
  const reduceMotion = useReducedMotion();
  const isBuy = side === "buy";
  const Icon = isBuy ? ArrowUpRight : ArrowDownRight;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={ariaLabel}
      onClick={onToggle}
      className={cn(
        // 12px matches the numeric fields it sits beside at every width, instead
        // of the 16px the button base uses below `sm`.
        "relative h-8.5 w-full overflow-hidden text-[12px] font-semibold tracking-[0.06em] shadow-xs/5 transition-[color,background-color,border-color] duration-200 sm:h-7.5",
        "active:scale-[0.98] motion-reduce:active:scale-100",
        isBuy
          ? "border-profit/35 bg-profit/10 text-profit hover:border-profit/50 hover:bg-profit/15 hover:text-profit dark:bg-profit/12"
          : "border-destructive/35 bg-destructive/10 text-destructive hover:border-destructive/50 hover:bg-destructive/15 hover:text-destructive dark:bg-destructive/12",
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={side}
          className="inline-flex items-center gap-1"
          initial={reduceMotion ? false : { opacity: 0, y: isBuy ? 8 : -8, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduceMotion ? undefined : { opacity: 0, y: isBuy ? -8 : 8, filter: "blur(2px)" }}
          transition={reduceMotion ? { duration: 0 } : FILL_ACTION_SPRING}
        >
          <motion.span
            aria-hidden
            initial={reduceMotion ? false : { rotate: isBuy ? -45 : 45, scale: 0.7 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={reduceMotion ? { duration: 0 } : FILL_ACTION_SPRING}
            className="inline-flex"
          >
            <Icon size={14} strokeWidth={2.25} aria-hidden />
          </motion.span>
          {side.toUpperCase()}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}

/** Optional Journal / Dividend panels — coss Accordion for clearer section separation. */
function SymbolExtrasAccordion({
  journalSummary,
  dividendSummary,
  journal,
  dividend,
}: {
  journalSummary?: string;
  dividendSummary?: string;
  journal: ReactNode;
  dividend: ReactNode;
}) {
  return (
    <Accordion multiple className="relative z-[1] flex flex-col gap-2">
      <AccordionItem value="journal" className={cn(cossPanelClass, "last:border-b")}>
        <AccordionTrigger className="group/acc-trigger relative z-[1] px-3 py-2.5 text-foreground hover:no-underline">
          <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
            <span className="text-[12px] font-semibold tracking-wide">Journal</span>
            {journalSummary ? (
              <span className="truncate text-[10px] font-normal text-muted-foreground group-data-panel-open/acc-trigger:hidden">
                {journalSummary}
              </span>
            ) : null}
          </span>
        </AccordionTrigger>
        <AccordionPanel className="relative z-[1] flex flex-col gap-4 px-3 pb-3 text-foreground">
          {journal}
        </AccordionPanel>
      </AccordionItem>

      <AccordionItem value="dividend" className={cn(cossPanelClass, "last:border-b")}>
        <AccordionTrigger className="group/acc-trigger relative z-[1] px-3 py-2.5 text-foreground hover:no-underline">
          <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
            <span className="text-[12px] font-semibold tracking-wide">Dividend</span>
            {dividendSummary ? (
              <span className="truncate text-[10px] font-normal text-muted-foreground group-data-panel-open/acc-trigger:hidden">
                {dividendSummary}
              </span>
            ) : null}
          </span>
        </AccordionTrigger>
        <AccordionPanel className="relative z-[1] flex flex-col gap-4 px-3 pb-3 text-foreground">
          {dividend}
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
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
  const multiplier = blockMultiplier(block);
  const openSide = block.side === "short" ? "sell" : "buy";
  const entryTotal = parsedRows
    .filter((r) => r.side === openSide)
    .reduce((s, r) => s + r.quantity * r.price * multiplier, 0);
  return {
    preview: previewTradePnl(block.side, parsedRows, multiplier, risk),
    initialRisk: risk,
    entryTotal: entryTotal > 0 ? entryTotal : null,
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
  onRemove,
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
  onRemove: () => void;
}) {
  const base = `trades[${index}]` as const;
  const reduceMotion = useReducedMotion();
  /**
   * The fill being removed is pulled from the tree so `AnimatePresence` can
   * play its exit, and the form array is spliced only once that finishes —
   * splicing first would re-index the survivors under the exiting clone.
   */
  const [removingRow, setRemovingRow] = useState<{ key: string; index: number } | null>(null);
  const visibleRows = useMemo(
    () =>
      block.rows
        .map((row, rowIndex) => ({ row, rowIndex }))
        .filter(({ row }) => !removingRow || row.key !== removingRow.key),
    [block.rows, removingRow],
  );
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
  const dropRow = (predicate: (row: ExecutionRow, rowIndex: number) => boolean) => {
    const next = block.rows.filter((row, rowIndex) => !predicate(row, rowIndex));
    if (next.length) form.setFieldValue(`${base}.rows` as never, next as never);
  };
  const requestRowRemoval = (rowKey: string | undefined, rowIndex: number) => {
    // Rows hydrated before keys existed, and reduced motion, skip the exit.
    if (!rowKey || reduceMotion) {
      dropRow((_row, i) => i === rowIndex);
      return;
    }
    setRemovingRow({ key: rowKey, index: rowIndex });
  };
  const commitRowRemoval = () => {
    if (!removingRow) return;
    dropRow((row) => row.key === removingRow.key);
    setRemovingRow(null);
  };
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
  const setupOptions = useMemo<MultiSelectOption[]>(
    () => setups.map((s) => ({ value: s.id, label: s.name })),
    [setups],
  );
  const tagOptions = useMemo<MultiSelectOption[]>(
    () => regularTags.map((t) => ({ value: t.id, label: t.name })),
    [regularTags],
  );
  const mistakeOptions = useMemo<MultiSelectOption[]>(
    () => mistakeTags.map((t) => ({ value: t.id, label: t.name })),
    [mistakeTags],
  );
  const suffix = index ? ` ${index + 1}` : "";
  const [open, setOpen] = useState(true);
  const collapsedSummary = [
    block.side.toUpperCase(),
    `${block.rows.length} fill${block.rows.length === 1 ? "" : "s"}`,
    preview.net != null ? fmtSignedMoney(preview.net, currency, locale) : "",
  ]
    .filter(Boolean)
    .join(" ·");
  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => setOpen(next)}
      className={cn("relative z-[1] gap-4 p-3 @container/symbol sm:p-4", cossPanelClass)}
      render={<section aria-label={`Symbol trade ${index + 1}`} />}
    >
      <div className="relative z-[1] flex items-center gap-2">
        <CollapsibleTrigger
          className="min-w-0 flex-1 items-center gap-2.5"
          aria-label={`Toggle symbol ${index + 1}`}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
            <span className="truncate text-[15px] font-semibold leading-none tracking-[-0.02em] text-foreground">
              {block.symbol || "Untitled"}
            </span>
            <span className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
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
            className="shrink-0 text-destructive"
            onClick={onRemove}
          >
            <Trash2 size={14} />
          </Button>
        ) : null}
      </div>
      <CollapsibleContent animation="fade">
        <div className="relative z-[1] flex flex-col gap-4">
          <div className="grid grid-cols-2 items-start gap-3 @min-[38rem]/symbol:grid-cols-4">
            <Field label="Market">
              <NativeSelect
                aria-label={`Market symbol ${index + 1}`}
                value={block.market}
                onChange={(e) => {
                  const market = e.target.value;
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
                className={fieldTextClass}
                wrapperClassName="w-full"
              >
                {MARKETS.map((m) => (
                  <NativeSelectOption key={m.value} value={m.value}>
                    {m.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {block.market === "future" && (
              <Field label="Contract">
                <OptionsSelect
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
                />
              </Field>
            )}
            <form.Field
              name={`${base}.symbol` as never}
              validators={{ onBlur: ({ value }) => (value ? undefined : "Symbol is required.") }}
            >
              {(field) => (
                <Field label="Symbol" error={fieldError(field.state.meta.errors)}>
                  <FormInput
                    aria-label={`Symbol${suffix}`}
                    value={field.state.value as string}
                    onChange={(e) => {
                      field.handleChange(e.target.value.toUpperCase() as never);
                      if (block.market === "future")
                        set("futuresPresetId", presetIdForSymbol(e.target.value));
                    }}
                    onBlur={field.handleBlur}
                    placeholder="Ticker"
                    className={cn("uppercase", fieldTextClass)}
                  />
                </Field>
              )}
            </form.Field>
            <Field label="Side">
              <SegmentedControl
                ariaLabel={`Side symbol ${index + 1}`}
                size="md"
                fullWidth
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
            </Field>
          </div>
          {block.market === "option" && (
            <div className="grid grid-cols-2 items-start gap-3 @min-[38rem]/symbol:grid-cols-4">
              <Field label="Multiplier">
                <AmountInput
                  aria-label={`Multiplier symbol ${index + 1}`}
                  value={block.multiplier}
                  onValueChange={(v) => set("multiplier", v)}
                  placeholder="100"
                  className={fieldTextClass}
                />
              </Field>
              <Field label="Right">
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
              </Field>
              <Field label="Strike">
                <AmountInput
                  aria-label={`Strike symbol ${index + 1}`}
                  value={block.option_strike}
                  onValueChange={(v) => {
                    set("option_strike", v);
                    syncContract({ option_strike: v });
                  }}
                  placeholder="325"
                  className={fieldTextClass}
                />
              </Field>
              <Field label="Expiry">
                <DatePicker
                  aria-label={`Expiry symbol ${index + 1}`}
                  value={block.option_expiry}
                  onChange={(v) => {
                    set("option_expiry", v);
                    syncContract({ option_expiry: v });
                  }}
                />
              </Field>
              {optionStrategy && (
                <p className="col-span-full text-[11px] text-muted-foreground">
                  {optionStrategy.label} · {optionStrategy.biasLabel}
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target">
              <AmountInput
                aria-label={`Target symbol ${index + 1}`}
                value={block.target}
                onValueChange={(v) => set("target", v)}
                placeholder="Optional"
                className={fieldTextClass}
              />
            </Field>
            <Field label="Stop">
              <AmountInput
                aria-label={`Stop symbol ${index + 1}`}
                value={block.stop}
                onValueChange={(v) => set("stop", v)}
                placeholder="Optional"
                className={fieldTextClass}
              />
            </Field>
          </div>
          <form.Field name={`${base}.rows` as never} mode="array">
            {(rowsField) => (
              <div className="flex flex-col gap-2">
                <span className={labelClass}>
                  {block.symbol ? `Executions · ${block.symbol}` : "Executions"}
                </span>
                <div
                  className={cn(
                    "hidden gap-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground @min-[46rem]/symbol:grid",
                    FILL_TABLE_COLS,
                  )}
                >
                  <span>Action</span>
                  <span>Date / Time</span>
                  <span>Qty</span>
                  <span>Price</span>
                  <span>Amount</span>
                  <span>Fee</span>
                  <span>P&L</span>
                  <span />
                </div>
                {/* popLayout pulls the removed fill out of flow at once, so the
                    rows below spring up rather than jump. */}
                <AnimatePresence initial={false} mode="popLayout" onExitComplete={commitRowRemoval}>
                  {visibleRows.map(({ row, rowIndex }) => (
                    <motion.div
                      key={row.key ?? `${block.key}-${rowIndex}`}
                      layout={reduceMotion ? false : "position"}
                      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={
                        reduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, y: -6, scale: 0.97, filter: "blur(2px)" }
                      }
                      transition={reduceMotion ? { duration: 0 } : FILL_ROW_SPRING}
                      className={cn(
                        // Stacked: a self-contained block per fill on an 8-column grid
                        // — fine enough that Action, Date / Time and the remove button
                        // always share the first row, with the numeric cells below.
                        "grid grid-cols-8 items-end gap-2 rounded-lg bg-muted/40 p-2.5",
                        // Table: one row, no surface of its own.
                        "@min-[46rem]/symbol:items-center @min-[46rem]/symbol:rounded-none @min-[46rem]/symbol:bg-transparent @min-[46rem]/symbol:p-0",
                        FILL_TABLE_COLS,
                      )}
                    >
                      <FillCell
                        label="Action"
                        className="col-span-2 @min-[46rem]/symbol:col-span-1"
                      >
                        <FillActionToggle
                          side={row.side}
                          aria-label={`Toggle action symbol ${index + 1} row ${rowIndex + 1}`}
                          onToggle={() =>
                            form.setFieldValue(
                              `${base}.rows[${rowIndex}].side` as never,
                              (row.side === "buy" ? "sell" : "buy") as never,
                            )
                          }
                        />
                      </FillCell>
                      <FillCell
                        label="Date / Time"
                        // Takes the rest of Action's row — six of eight tracks — so a
                        // whole timestamp stays readable in the narrowest block.
                        className="col-span-6 @min-[46rem]/symbol:col-span-1"
                      >
                        <form.Field name={`${base}.rows[${rowIndex}].executed_at` as never}>
                          {(field) => (
                            <DateTimePicker
                              aria-label={`Date/time symbol ${index + 1} row ${rowIndex + 1}`}
                              value={field.state.value as string}
                              onChange={(v) => field.handleChange(v as never)}
                              compact
                            />
                          )}
                        </form.Field>
                      </FillCell>
                      <FillCell
                        label="Qty"
                        className="col-span-4 @min-[34rem]/symbol:col-span-2 @min-[46rem]/symbol:col-span-1"
                      >
                        <form.Field
                          name={`${base}.rows[${rowIndex}].quantity` as never}
                          validators={{
                            onBlur: ({ value }) => validatePositiveAmount(value as string, "Qty"),
                          }}
                        >
                          {(field) => (
                            <AmountInput
                              aria-label={`Qty${index ? ` symbol ${index + 1}` : ""} row ${rowIndex + 1}`}
                              value={field.state.value as string}
                              onValueChange={(v) => field.handleChange(v as never)}
                              placeholder="Qty"
                              compact
                            />
                          )}
                        </form.Field>
                      </FillCell>
                      <FillCell
                        label="Price"
                        className="col-span-4 @min-[34rem]/symbol:col-span-2 @min-[46rem]/symbol:col-span-1"
                      >
                        <form.Field
                          name={`${base}.rows[${rowIndex}].price` as never}
                          validators={{
                            onBlur: ({ value }) => validatePositiveAmount(value as string, "Price"),
                          }}
                        >
                          {(field) => (
                            <AmountInput
                              aria-label={`Price${index ? ` symbol ${index + 1}` : ""} row ${rowIndex + 1}`}
                              value={field.state.value as string}
                              onValueChange={(v) => field.handleChange(v as never)}
                              placeholder="Price"
                              compact
                            />
                          )}
                        </form.Field>
                      </FillCell>
                      <FillCell
                        label="Amount"
                        className="col-span-4 @min-[34rem]/symbol:col-span-2 @min-[46rem]/symbol:col-span-1"
                      >
                        <FillAmountCell
                          quantity={parsedRows[rowIndex]?.quantity ?? 0}
                          price={parsedRows[rowIndex]?.price ?? 0}
                          multiplier={multiplier}
                          currency={currency}
                          locale={locale}
                          emptyLabel={`Amount symbol ${index + 1} row ${rowIndex + 1}: empty`}
                        />
                      </FillCell>
                      <FillCell
                        label="Fee"
                        className="col-span-4 @min-[34rem]/symbol:col-span-2 @min-[46rem]/symbol:col-span-1"
                      >
                        <form.Field
                          name={`${base}.rows[${rowIndex}].fees` as never}
                          validators={{
                            onBlur: ({ value }) =>
                              validateNonNegativeAmount(value as string, "Fee"),
                          }}
                        >
                          {(field) => (
                            <AmountInput
                              aria-label={`Fee${index ? ` symbol ${index + 1}` : ""} row ${rowIndex + 1}`}
                              value={field.state.value as string}
                              onValueChange={(v) => field.handleChange(v as never)}
                              placeholder="Fee"
                              compact
                            />
                          )}
                        </form.Field>
                      </FillCell>
                      <FillCell
                        label="P&L"
                        // Stacked: owns its whole line so the value reads as the
                        // block's result rather than a stray cell.
                        className="col-span-8 @min-[46rem]/symbol:col-span-1"
                      >
                        <FillPnlCell
                          value={fillPnls[rowIndex]}
                          currency={currency}
                          locale={locale}
                          emptyLabel={`P&L symbol ${index + 1} row ${rowIndex + 1}: empty`}
                        />
                      </FillCell>
                      {block.rows.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove row symbol ${index + 1} row ${rowIndex + 1}`}
                          onClick={() => requestRowRemoval(row.key, rowIndex)}
                          // Stacked: a full-width block closing out the fill.
                          // Table: back to a square icon in the row's last column.
                          className={cn(
                            "col-span-8 h-8 w-full text-destructive hover:text-destructive",
                            // Stacked only: soft destructive surface, same chrome family
                            // as the Buy / Sell toggle above it. Scoped with @max so the
                            // table tier keeps the plain ghost icon — an unscoped
                            // `dark:` fill would outrank any @min reset.
                            "@max-[46rem]/symbol:border-destructive/35 @max-[46rem]/symbol:bg-destructive/10 @max-[46rem]/symbol:hover:border-destructive/50 @max-[46rem]/symbol:hover:bg-destructive/15 @max-[46rem]/symbol:dark:bg-destructive/12",
                            // Table: back to a bare icon in the row's last column.
                            "@min-[46rem]/symbol:col-span-1 @min-[46rem]/symbol:size-7.5 @min-[46rem]/symbol:justify-self-end",
                          )}
                        >
                          <Trash2 size={14} />
                        </Button>
                      ) : (
                        <span aria-hidden />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
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
                  className="mx-auto mt-2 size-8 rounded-full before:rounded-full sm:size-7.5"
                >
                  <Plus size={15} />
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

          <SymbolExtrasAccordion
            journalSummary={
              [
                block.setupIds.length
                  ? `${block.setupIds.length} setup${block.setupIds.length === 1 ? "" : "s"}`
                  : "",
                block.session,
                block.emotionalStates.length > 2
                  ? `${block.emotionalStates.slice(0, 2).join(", ")} +${block.emotionalStates.length - 2}`
                  : joinEmotionalStates(block.emotionalStates),
                screenshotFiles.length
                  ? `${screenshotFiles.length} shot${screenshotFiles.length === 1 ? "" : "s"}`
                  : "",
              ]
                .filter(Boolean)
                .join(" ·") || undefined
            }
            dividendSummary={
              block.dividendAmount.trim() ? `${block.dividendAmount} ${currency}` : undefined
            }
            journal={
              <>
                {setups.length === 0 ? (
                  <div>
                    <span className={labelClass}>Setups</span>
                    <p className="text-[11px] text-muted-foreground">
                      No setups yet — create some in Playbook.
                    </p>
                  </div>
                ) : (
                  <JournalField
                    label="Setups"
                    hint="Select any that apply — the first becomes the main setup."
                  >
                    <MultiSelectCombobox
                      ariaLabel={`Setups${suffix}`}
                      options={setupOptions}
                      value={block.setupIds}
                      onValueChange={(ids) => set("setupIds", ids)}
                      placeholder="Select setups"
                      searchPlaceholder="Search setups…"
                      emptyText="No matching setups."
                    />
                  </JournalField>
                )}
                <JournalField
                  label="Session"
                  hint="One session per trade."
                  htmlFor={`nt-session-${block.key}`}
                >
                  <NativeSelect
                    id={`nt-session-${block.key}`}
                    aria-label={`Session${suffix}`}
                    value={block.session}
                    onChange={(e) => set("session", e.target.value)}
                    className={fieldTextClass}
                    wrapperClassName="w-full"
                  >
                    <NativeSelectOption value="">No session</NativeSelectOption>
                    {TRADE_SESSIONS.map((s) => (
                      <NativeSelectOption key={s} value={s}>
                        {s}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </JournalField>
                <JournalField
                  label="Emotion"
                  hint="Select every state that applied during the trade."
                >
                  <MultiSelectCombobox
                    ariaLabel={`Emotion${suffix}`}
                    options={EMOTION_OPTIONS}
                    value={block.emotionalStates}
                    onValueChange={(states) => set("emotionalStates", states)}
                    placeholder="Select emotions"
                    searchPlaceholder="Search emotions…"
                    emptyText="No matching emotions."
                  />
                </JournalField>
                {regularTags.length > 0 && (
                  <JournalField label="Tags">
                    <MultiSelectCombobox
                      ariaLabel={`Tags${suffix}`}
                      options={tagOptions}
                      value={block.selectedTagIds}
                      onValueChange={(ids) => set("selectedTagIds", ids)}
                      placeholder="Select tags"
                      searchPlaceholder="Search tags…"
                      emptyText="No matching tags."
                    />
                  </JournalField>
                )}
                {mistakeTags.length > 0 && (
                  <JournalField label="Mistake type" hint="Optional — select any that apply.">
                    <MultiSelectCombobox
                      ariaLabel={`Mistake type${suffix}`}
                      options={mistakeOptions}
                      value={block.selectedMistakeIds}
                      onValueChange={(ids) => set("selectedMistakeIds", ids)}
                      placeholder="Select mistakes"
                      searchPlaceholder="Search mistakes…"
                      emptyText="No matching mistakes."
                    />
                  </JournalField>
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
                  <FormTextarea
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
                  <FormTextarea
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
                  <FormTextarea
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
              </>
            }
            dividend={
              <>
                <p className="m-0 text-[10px] leading-snug text-muted-foreground">
                  Optional payout on this symbol. Amount rolls into trade P&amp;L (shorts as a
                  debit).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <JournalField label={`Amount (${currency})`}>
                    <AmountInput
                      aria-label={`Dividend amount${suffix}`}
                      value={block.dividendAmount}
                      onValueChange={(v) => set("dividendAmount", v)}
                      placeholder="0.00"
                      className={fieldTextClass}
                    />
                  </JournalField>
                  <JournalField label="Date">
                    <DatePicker
                      aria-label={`Dividend date${suffix}`}
                      value={block.dividendDate}
                      onChange={(v) => set("dividendDate", v)}
                    />
                  </JournalField>
                </div>
                <JournalField label="Note">
                  <FormInput
                    aria-label={`Dividend note${suffix}`}
                    value={block.dividendNote}
                    onChange={(e) => set("dividendNote", e.target.value)}
                    placeholder="Optional"
                    className={fieldTextClass}
                  />
                </JournalField>
              </>
            }
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function NewTradeDrawer() {
  usePrivacyMode();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const open = useUI((s) => s.modal === "new-trade");
  const editTradeId = useUI((s) => s.editTradeId);
  const editTradeDetail = useUI((s) => s.editTradeDetail);
  const closeModal = useUI((s) => s.closeModal);
  const isEditMode = Boolean(editTradeId);
  const isImportPreviewEdit = isImportPreviewEditId(editTradeId);
  const filterAccountId = useFilters((s) => soleAccountId(s.accountIds));
  const accounts = useAccounts().data ?? [];
  const setups = useSetups().data ?? [];
  const allTags = useTags().data;
  const mistakeTags = useMemo(() => (allTags ?? []).filter((t) => t.kind === "mistake"), [allTags]);
  const regularTags = useMemo(() => (allTags ?? []).filter((t) => t.kind !== "mistake"), [allTags]);
  const createExecutions = useCreateExecutions();
  const updateExecution = useUpdateExecution();
  const deleteExecution = useDeleteExecution();
  const editTradeQ = useTradeDetail(editTradeId ?? "");
  /** Prefer the snapshot passed at open; fall back to query cache/network. */
  const editSource = editTradeDetail ?? editTradeQ.data;
  const ocrParse = useOcrParse();
  const { data: ocrSettings, isLoading: ocrSettingsLoading } = useOcrSettings();
  const visionReady = isOcrVisionReady(ocrSettings);
  const toast = useToastManager();
  const maxScreenshots = useJournalPrefs((s) => s.maxScreenshotsPerTrade);
  const [pendingFilesByKey, setPendingFilesByKey] = useState<Record<string, File[]>>({});
  /**
   * Key of the card currently playing its exit animation. It stays in the form
   * values until the animation finishes — dropping it up front would leave the
   * still-mounted card's `form.Field`s reading an out-of-range index, flipping
   * every input from controlled to uncontrolled mid-exit.
   */
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [ocrExtract, setOcrExtract] = useState<TradeExtract | null>(null);
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [ocrSetupPromptOpen, setOcrSetupPromptOpen] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  /** Bumps when edit form is hydrated so Field trees remount with filled values. */
  const [editFormKey, setEditFormKey] = useState(0);
  const [editHydrated, setEditHydrated] = useState(false);
  const [templates, setTemplates] = useState<TradeTemplate[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const ocrFileRef = useRef<HTMLInputElement>(null);
  const fillFileRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
  const prefilledEditId = useRef<string | null>(null);
  const locale = getIntlLocale(getStoredLocale());
  const defaultValuesRef = useRef(defaultNewTradeFormValues());
  const form = useForm({
    formId: "new-trade",
    defaultValues: defaultValuesRef.current,
    onSubmit: async ({ value }) => {
      setSubmitError("");
      const editId = useUI.getState().editTradeId;
      if (editId && isImportPreviewEditId(editId)) {
        const block = value.trades[0];
        const right = block?.option_right;
        const optionRight = right === "call" || right === "put" ? right : "";
        const apply = useUI.getState().importPreviewApply;
        apply?.(optionRight);
        close();
        return;
      }

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
      const rows = flattenSymbolTradesToExecutions(value.trades);
      if (rows.length === 0) {
        setSubmitError("Add at least one valid execution row.");
        return;
      }

      if (editId) {
        const existing = useUI.getState().editTradeDetail ?? editTradeQ.data;
        if (!existing) {
          setSubmitError("Trade still loading — try again.");
          return;
        }
        setEditSaving(true);
        try {
          const existingIds = new Set(existing.fills.map((f) => f.id));
          const keptIds = new Set(rows.map((r) => r.id).filter((id): id is string => Boolean(id)));
          let tradeId = editId;

          for (const row of rows) {
            if (row.id && existingIds.has(row.id)) {
              const res = await updateExecution.mutateAsync({
                id: row.id,
                body: {
                  side: row.side,
                  quantity: row.quantity,
                  price: row.price,
                  fees: row.fees,
                  commission: row.commission,
                  executed_at: row.executed_at,
                },
              });
              if (res.trade_id) tradeId = res.trade_id;
            } else {
              const { id: _omit, ...body } = row;
              const res = await createExecutions.mutateAsync({
                accountIds: [accountId],
                rows: [body],
              });
              tradeId = res.tradeIds[0] ?? tradeId;
            }
          }

          for (const fill of existing.fills) {
            if (!keptIds.has(fill.id)) {
              const res = await deleteExecution.mutateAsync(fill.id);
              if (res.trade_id) tradeId = res.trade_id;
              else if (!res.trade_id && existing.fills.length <= 1) {
                tradeId = "";
              }
            }
          }

          const block = value.trades[0];
          if (block && tradeId) {
            await tradesApi.patch(tradeId, {
              notes: buildStructuredJournalNotes({
                session: block.session,
                entryReason: block.entryReason,
                exitReason: block.exitReason,
                reviewNotes: block.reviewNotes,
              }),
              setup_id: block.setupIds[0] ?? "",
              setup_ids: block.setupIds,
              emotional_state: joinEmotionalStates(block.emotionalStates),
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
              await attachmentsApi.upload(tradeId, fd);
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
                trade_id: tradeId,
              });
            }
          }

          toast.add({
            title: "Trade updated",
            description: tradeId
              ? "Fills and journal saved."
              : "All fills removed — returned to trades.",
          });
          close();
          if (tradeId) {
            void navigate({ to: "/trades/$id", params: { id: tradeId } });
          } else {
            void navigate({ to: "/trades" });
          }
        } catch (error) {
          const message =
            error instanceof ExecutionBatchError
              ? error.failures
                  .map((f) => `Row ${f.index + 1} (${f.accountId}): ${f.message}`)
                  .join(";")
              : error instanceof Error
                ? error.message
                : "Save failed";
          setSubmitError(message);
          toast.add({ title: "Could not update trade", description: message });
        } finally {
          setEditSaving(false);
        }
        return;
      }

      const accountIds = [accountId, ...value.copyAccountIds.filter((id) => id !== accountId)];
      try {
        const { tradeIds, bySymbol } = await createExecutions.mutateAsync({
          accountIds,
          rows: rows.map(({ id: _id, ...body }) => body),
        });
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
              emotional_state: joinEmotionalStates(block.emotionalStates),
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
                .join(";")
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
  const accountFilters = useMemo(() => ({ account_id: accountId || undefined }), [accountId]);
  const summaryQ = useSummary(accountFilters);
  const cashQ = useCash(accountFilters);
  const accountBaseline = !accountId
    ? {
        netPnl: null as number | null,
        cash: null as number | null,
        deposited: null as number | null,
      }
    : (() => {
        const stats = computeHeaderStats({
          accounts,
          accountIds: accountId,
          cashTx: cashQ.data ?? [],
          summary: summaryQ.data,
          trades: [],
        });
        // cash = deposits + netPnl, so deposits fall out without a second query.
        return { netPnl: stats.netPnl, cash: stats.cash, deposited: stats.cash - stats.netPnl };
      })();
  const pending =
    createExecutions.isPending ||
    updateExecution.isPending ||
    deleteExecution.isPending ||
    editSaving;

  /**
   * Cards to render. The card being removed is pulled from the tree so
   * `AnimatePresence` plays its exit, while its index is captured beforehand so
   * the survivors keep pointing at their real `trades[i]` path meanwhile.
   */
  const visibleTrades = useMemo(
    () =>
      values.trades
        .map((block, index) => ({ block, index }))
        .filter(({ block }) => block.key !== removingKey),
    [values.trades, removingKey],
  );

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
      entryTotal: result.entryTotal,
    };
  }, [values.trades]);

  /** Commit the deferred removal once the card has finished animating out. */
  function commitRemoval() {
    if (!removingKey) return;
    const next = (form.store.state.values.trades as SymbolTradeBlock[]).filter(
      (block) => block.key !== removingKey,
    );
    form.setFieldValue("trades", next.length ? next : [emptySymbolTrade()]);
    setPendingFilesByKey((prev) => {
      const { [removingKey]: _dropped, ...rest } = prev;
      return rest;
    });
    setRemovingKey(null);
  }

  function reset() {
    form.reset(defaultNewTradeFormValues());
    setPendingFilesByKey({});
    setRemovingKey(null);
    setOcrExtract(null);
    setOcrWarnings([]);
    setSubmitError("");
    setTemplatesOpen(false);
    const acct = filterAccountId || accounts[0]?.id || "";
    if (acct) form.setFieldValue("accountId", acct);
  }

  function close() {
    reset();
    prefilledEditId.current = null;
    setEditHydrated(false);
    closeModal();
    setOcrSetupPromptOpen(false);
  }

  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      prefilledEditId.current = null;
      setEditHydrated(false);
      return;
    }
    if (wasOpen.current) return;
    wasOpen.current = true;
    setPendingFilesByKey({});
    setOcrExtract(null);
    setOcrWarnings([]);
    setSubmitError("");
    setTemplates(listTradeTemplates());

    const editingId = useUI.getState().editTradeId;
    if (editingId) {
      // Prefill runs when edit snapshot / detail is available.
      return;
    }

    setEditHydrated(true);
    form.reset(defaultNewTradeFormValues());
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

  useEffect(() => {
    if (!open || !editTradeId || !editSource) return;
    if (prefilledEditId.current === editTradeId) return;
    prefilledEditId.current = editTradeId;
    const nextValues = {
      accountId: editSource.account_id,
      copyAccountIds: [] as string[],
      trades: [symbolTradeFromDetail(editSource)],
    };
    // Match NewSetupDrawer / template apply: reset + setFieldValue so nested
    // array Fields remount cleanly with filled values.
    form.reset(nextValues);
    form.setFieldValue("accountId", nextValues.accountId);
    form.setFieldValue("copyAccountIds", nextValues.copyAccountIds);
    form.setFieldValue("trades", nextValues.trades);
    setPendingFilesByKey({});
    setSubmitError("");
    setEditFormKey((k) => k + 1);
    setEditHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefill once per edit id
  }, [open, editTradeId, editSource]);

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
        emotionalStates: parseEmotionalStates(template.emotionalState),
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
      emotionalState: joinEmotionalStates(block.emotionalStates),
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

  const importFillFile = async (file: File) => {
    try {
      const extract = parseFillFile(file.name, await file.text());
      form.setFieldValue("trades", tradesFromOcrExtract(extract));
      setPendingFilesByKey({});
      setOcrExtract(extract);
      setOcrWarnings(extract.warnings ?? []);
      toast.add({
        title: "Fills loaded",
        description: ocrScanToastDescription(extract),
      });
    } catch (error) {
      toast.add({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not read file",
        type: "error",
      });
    }
  };

  const openVisionSettings = () => {
    close();
    void navigate({ to: "/settings" });
    window.location.hash = "ai";
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
            <DrawerTitle>
              {isImportPreviewEdit ? "Edit Trade" : isEditMode ? "Edit Trade" : "New Trade"}
            </DrawerTitle>
            <div className="ml-auto flex items-center gap-0.5">
              {!isEditMode && (
                <ControlledPopover
                  open={templatesOpen}
                  onOpenChange={setTemplatesOpen}
                  triggerAriaLabel="Templates"
                  className="min-w-[14rem] overflow-hidden p-0"
                  triggerClassName={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "text-sm",
                    templatesOpen && "border-border bg-accent text-foreground",
                  )}
                  trigger={
                    <>
                      <FileStack size={14} strokeWidth={1.75} aria-hidden />
                      Templates
                    </>
                  }
                >
                  <div className="flex flex-col p-1" role="menu" aria-label="Trade templates">
                    {templates.length === 0 ? (
                      <p className="m-0 px-2 py-2 text-[11px] text-muted-foreground">
                        No saved templates yet
                      </p>
                    ) : (
                      templates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          role="menuitem"
                          onClick={() => applyTemplate(t)}
                          className={cn(
                            "flex min-h-8 cursor-pointer items-center rounded-md px-2 text-left text-[12px] text-foreground",
                            "transition-colors hover:bg-accent",
                            "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{t.name}</span>
                        </button>
                      ))
                    )}
                    {templates.length > 0 ? <div className="my-1 h-px bg-border" /> : null}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={saveTemplate}
                      className={cn(
                        "flex min-h-8 cursor-pointer items-center rounded-md px-2 text-left text-[12px] font-medium text-primary",
                        "transition-colors hover:bg-primary/10",
                        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                      )}
                    >
                      Save first symbol as template…
                    </button>
                  </div>
                </ControlledPopover>
              )}
              <DrawerClose
                aria-label="Close"
                className={cn(
                  "inline-flex size-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent",
                  "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                )}
              >
                <X size={16} strokeWidth={1.5} />
              </DrawerClose>
            </div>
          </DrawerHeader>
          <DrawerBody>
            <ModalBanner>
              {isImportPreviewEdit
                ? "Import preview — review fills and set call/put. Apply updates this row; Confirm import writes the account."
                : isEditMode
                  ? "Update fills, journal, and optional dividend for this trade."
                  : "Add one or more symbols — each with fills, journal, and optional dividend. One Save logs every symbol as its own trade."}
            </ModalBanner>
            {isEditMode && !editHydrated && !editSource && editTradeQ.isLoading ? (
              <p className="mt-6 text-center text-[13px] text-muted-foreground">Loading trade…</p>
            ) : isEditMode && !editHydrated && !editSource && editTradeQ.isError ? (
              <p className="mt-6 text-center text-[13px] text-destructive">
                Could not load trade for editing.
              </p>
            ) : isEditMode && !editHydrated ? (
              <p className="mt-6 text-center text-[13px] text-muted-foreground">Loading trade…</p>
            ) : (
              <form
                key={isEditMode ? `edit-${editTradeId}-${editFormKey}` : "new-trade"}
                className="mt-4 flex flex-col gap-4 @container/form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void form.handleSubmit();
                }}
              >
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-48 flex-1">
                    <label className={labelClass}>Account</label>
                    <NativeSelect
                      aria-label="Account"
                      value={accountId}
                      onChange={(e) => form.setFieldValue("accountId", e.target.value)}
                      disabled={isEditMode}
                      className={cn("w-full", fieldTextClass)}
                      wrapperClassName="w-full"
                    >
                      {accounts.map((a) => (
                        <NativeSelectOption key={a.id} value={a.id}>
                          {a.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  {!isEditMode && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={ocrParse.isPending || ocrSettingsLoading}
                        onClick={onScanClick}
                        className={cn(
                          // Field height, not button height — it sits on the
                          // Account select's baseline (`size="sm"` is 2px short).
                          "h-8.5 text-sm font-medium sm:h-7.5",
                          !visionReady && "text-muted-foreground",
                          ocrParse.isPending && "opacity-70",
                        )}
                        aria-label="Prefill trade from screenshot"
                        title={
                          visionReady
                            ? "Select one or more screenshots"
                            : "Set up screenshot scan in Settings before scanning"
                        }
                      >
                        {ocrParse.isPending ? (
                          <Loader2
                            size={14}
                            strokeWidth={1.75}
                            className="animate-spin"
                            aria-hidden
                          />
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fillFileRef.current?.click()}
                        className="h-8.5 text-sm font-medium sm:h-7.5"
                        aria-label="Prefill trade from a CSV or JSON file"
                        title="Select a CSV or JSON file of fills"
                      >
                        <FileUp size={14} aria-hidden />
                        Import file
                      </Button>
                      <input
                        ref={fillFileRef}
                        type="file"
                        accept=".csv,.json,text/csv,text/comma-separated-values,application/json,text/plain"
                        data-testid="fill-file-input"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) void importFillFile(file);
                        }}
                      />
                    </>
                  )}
                </div>
                {!isEditMode &&
                  accounts.filter((account) => account.id !== accountId).length > 0 && (
                    <div>
                      <span className={labelClass}>Also save to</span>
                      <div className="flex flex-wrap gap-2">
                        {accounts
                          .filter((account) => account.id !== accountId)
                          .map((account) => (
                            <label
                              key={account.id}
                              className="flex cursor-pointer items-center gap-2 rounded-md bg-muted px-3 py-2 text-[12px] text-muted-foreground"
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
                {!isEditMode && ocrExtract && (
                  <OcrScanSummary groups={groupOcrBySymbol(ocrExtract)} warnings={ocrWarnings} />
                )}
                {/* popLayout pulls a removed card out of flow immediately so the
                    cards below spring up instead of jumping. */}
                <AnimatePresence initial={false} mode="popLayout" onExitComplete={commitRemoval}>
                  {visibleTrades.map(({ block, index }) => (
                    <motion.div
                      key={block.key}
                      layout={reduceMotion ? false : "position"}
                      initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={
                        reduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, y: -8, scale: 0.96, filter: "blur(2px)" }
                      }
                      transition={reduceMotion ? { duration: 0 } : SYMBOL_CARD_SPRING}
                    >
                      <SymbolCard
                        form={form}
                        block={block}
                        index={index}
                        currency={currency}
                        locale={locale}
                        removable={!isEditMode && values.trades.length > 1}
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
                        onRemove={() => setRemovingKey((current) => current ?? block.key)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {!isEditMode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      form.setFieldValue("trades", [...values.trades, emptySymbolTrade()])
                    }
                    disabled={pending}
                    className="mx-auto text-sm"
                  >
                    <Plus size={15} />
                    Add symbol
                  </Button>
                )}
                {submitError && <p className="text-xs text-destructive">{submitError}</p>}
                {batchPreview ? (
                  <BatchTradeResultPreview
                    batch={batchPreview}
                    currency={currency}
                    locale={locale}
                    accountNetPnl={accountBaseline.netPnl}
                    accountCash={accountBaseline.cash}
                    depositedCapital={accountBaseline.deposited}
                  />
                ) : singleFooter ? (
                  <AfterSaveResultPreview
                    preview={singleFooter.preview}
                    entryTotal={singleFooter.entryTotal}
                    accountNetPnl={accountBaseline.netPnl}
                    accountCash={accountBaseline.cash}
                    depositedCapital={accountBaseline.deposited}
                    currency={currency}
                    locale={locale}
                    initialRisk={singleFooter.risk}
                  />
                ) : null}
                <div
                  className={cn(
                    // Narrow: full-width stacked block so each action is a whole
                    // tap target. Wider: the usual inline group, right-aligned.
                    "flex flex-col gap-2 *:w-full",
                    "@min-[30rem]/form:flex-row @min-[30rem]/form:flex-wrap @min-[30rem]/form:items-center @min-[30rem]/form:justify-end @min-[30rem]/form:*:w-auto",
                  )}
                >
                  {!isEditMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={reset}
                      className="text-sm"
                    >
                      Clear
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={close}
                    className="text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    loading={pending}
                    disabled={pending || (isEditMode && !editHydrated)}
                    onClick={() => {
                      void form.handleSubmit();
                    }}
                    className="text-sm"
                  >
                    {isImportPreviewEdit ? (
                      <Trans>Apply</Trans>
                    ) : isEditMode ? (
                      <Trans>Save changes</Trans>
                    ) : (
                      <Trans>Save</Trans>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </DrawerBody>
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
