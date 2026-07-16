import { useForm, useStore } from "@tanstack/react-form";
import { ChevronDown, FileStack, Plus, ScanLine, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../../components/Drawer";
import { ModalBanner } from "../../components/Modal";
import { Pill } from "../../components/Pill";
import { SegmentedControl } from "../../components/SegmentedControl";
import { SignalDatePicker } from "../../components/SignalDatePicker";
import { SignalDateTimePicker } from "../../components/SignalDateTimePicker";
import { fieldError, SignalField } from "../../components/SignalField";
import { SignalInput, SignalTextarea } from "../../components/SignalInput";
import { SignalAmountInput } from "../../components/SignalAmountInput";
import {
  signalFieldErrorClass,
  signalInputClass,
  signalLabelClass,
} from "../../components/signal-field-styles";
import { signalSelectListClass } from "../../components/signal-overlay-styles";
import { SignalPopover } from "../../components/SignalPopover";
import { SignalSelect } from "../../components/SignalSelect";
import { GradeControl } from "../../components/GradeControl";
import {
  fileToScreenshotItem,
  JournalScreenshotUpload,
} from "../../components/JournalScreenshotUpload";
import { useToastManager } from "../../components/Toast";
import { ApiError } from "../../lib/api/client";
import { attachmentsApi } from "../../lib/api/attachments";
import { cashApi } from "../../lib/api/cash";
import type { TradeExtract } from "../../lib/api/ocr";
import { tradesApi } from "../../lib/api/trades";
import { useFilters, normalizeFilterDate } from "../../lib/filters";
import { capScreenshots, useJournalPrefs } from "../../lib/journalPrefs";
import {
  buildStructuredJournalNotes,
  computeInitialRisk,
  EMOTIONAL_STATES,
  parseJournalNotes,
  weightedAvgEntry,
} from "../../lib/newTradeJournal";
import { localDateString } from "../../lib/dateRangePresets";
import { usePrivacyMode } from "../../lib/displayPrefs";
import { fmtSignedMoney } from "../../lib/format";
import {
  CUSTOM_PRESET_ID,
  FUTURES_PRESETS,
  multiplierForPreset,
  presetIdForSymbol,
} from "../../lib/futuresPresets";
import { checkTradeCompliance } from "../../lib/tradeCompliance";
import { gradeFromInt, intFromGrade, TRADE_SESSIONS } from "../../lib/tradeGrades";
import { previewTradePnl } from "../../lib/tradePnlPreview";
import {
  listTradeTemplates,
  saveTradeTemplate,
  type TradeTemplate,
} from "../../lib/tradeTemplates";
import { useAccounts } from "../../lib/hooks/useAccounts";
import { useSummary } from "../../lib/hooks/useAnalytics";
import { ExecutionBatchError, useCreateExecutions } from "../../lib/hooks/useExecutions";
import { useOcrParse } from "../../lib/hooks/useOcrParse";
import { useRiskRules } from "../../lib/hooks/useRiskRules";
import { useSetups } from "../../lib/hooks/useSetups";
import { useTags } from "../../lib/hooks/useTags";
import { useTrades } from "../../lib/hooks/useTrades";
import { getIntlLocale, getStoredLocale } from "../../lib/locale";
import { useUI } from "../../lib/ui";
import { cn } from "../../lib/cn";
import { parseAmountToNumber } from "../../lib/amountInput";
import {
  defaultNewTradeFormValues,
  emptyExecutionRow,
  nowLocalDatetime,
  parseTradeRows,
  validateNonNegativeAmount,
  validatePositiveAmount,
  validateSymbol,
  validateTradeRows,
  type ExecutionRow,
  type NewTradeFormValues,
} from "../../lib/newTradeFormSchema";

const MARKETS = [
  { value: "stock", label: "STOCK" },
  { value: "option", label: "OPTION" },
  { value: "crypto", label: "CRYPTO" },
  { value: "future", label: "FUTURES" },
  { value: "forex", label: "FOREX" },
];

type Tab = "general" | "journal" | "dividends";

export type Row = ExecutionRow;

const labelClass = signalLabelClass;

const inputClass = signalInputClass;

/** Fill row: date/time is 4fr of 5fr flex band (~20% narrower than a lone 1fr). */
const FILL_ROW_COLS = "72px 4fr 64px 72px 64px 64px 32px 1fr";

const btnGhost =
  "inline-flex h-10 cursor-pointer items-center rounded-control border-none bg-bg-input px-3.5 text-[12px] font-medium text-text-muted transition-colors hover:bg-bg-input-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-50";

const btnPrimary =
  "inline-flex h-10 cursor-pointer items-center justify-center rounded-control border-none bg-accent px-5 text-[13px] font-semibold text-bg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

function parseNum(v: string): number | null {
  return parseAmountToNumber(v);
}

/** Convert RFC3339 / ISO to datetime-local value (with seconds). */
function toDatetimeLocal(iso: string): string {
  if (!iso.trim()) return nowLocalDatetime();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return nowLocalDatetime();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatNumField(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "";
  return String(n);
}

export function rowsFromOcrExtract(extract: TradeExtract, fallbackSide: "long" | "short"): Row[] {
  if (!extract.rows?.length) {
    return [emptyExecutionRow(fallbackSide === "long" ? "buy" : "sell")];
  }
  return extract.rows.map((r) => {
    const side: "buy" | "sell" = r.side === "sell" ? "sell" : "buy";
    return {
      side,
      executed_at: toDatetimeLocal(r.executed_at ?? ""),
      quantity: r.quantity > 0 ? String(r.quantity) : "",
      price: r.price > 0 ? String(r.price) : "",
      fees: formatNumField(r.fees),
      commission: formatNumField(r.commission),
    };
  });
}

export function NewTradeDrawer() {
  usePrivacyMode();
  const open = useUI((s) => s.modal === "new-trade");
  const closeModal = useUI((s) => s.closeModal);
  const filterAccountId = useFilters((s) => s.accountId);
  const accounts = useAccounts().data ?? [];
  const setups = useSetups().data ?? [];
  const allTags = useTags().data ?? [];
  const mistakeTags = useMemo(() => allTags.filter((t) => t.kind === "mistake"), [allTags]);
  const regularTags = useMemo(() => allTags.filter((t) => t.kind !== "mistake"), [allTags]);
  const toast = useToastManager();
  const createExecutions = useCreateExecutions();
  const ocrParse = useOcrParse();
  const ocrFileRef = useRef<HTMLInputElement>(null);
  const riskRulesQ = useRiskRules();
  const intlLocale = getIntlLocale(getStoredLocale());
  const today = localDateString(new Date());
  const todayFilters = useMemo(
    () => ({
      account_id: filterAccountId,
      from: normalizeFilterDate(today, "start"),
      to: normalizeFilterDate(today, "end"),
    }),
    [filterAccountId, today],
  );
  const todaySummaryQ = useSummary(todayFilters);
  const openTradesQ = useTrades({
    account_id: filterAccountId,
    status: "open",
  });
  const openRiskTotal = useMemo(() => {
    const trades = openTradesQ.data ?? [];
    return trades.reduce((sum, t) => {
      const r = t.initial_risk;
      return sum + (r != null && r > 0 ? r : 0);
    }, 0);
  }, [openTradesQ.data]);

  const [tab, setTab] = useState<Tab>("general");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const maxScreenshots = useJournalPrefs((s) => s.maxScreenshotsPerTrade);
  const [ocrRawText, setOcrRawText] = useState("");
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [showOcrText, setShowOcrText] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [templates, setTemplates] = useState<TradeTemplate[]>([]);

  const form = useForm({
    defaultValues: defaultNewTradeFormValues(),
    validators: {
      onSubmit: ({ value }) => {
        const accountId = value.accountId || filterAccountId || accounts[0]?.id || "";
        if (!accountId) return "Account is required.";
        const symErr = validateSymbol(value.symbol);
        if (symErr) return symErr;
        const rowsErr = validateTradeRows(value.rows);
        if (rowsErr) return rowsErr;
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError("");
      const effectiveAccountId = value.accountId || filterAccountId || accounts[0]?.id || "";
      const parsedRows = parseTradeRows(value.rows);
      const accountIds = [
        effectiveAccountId,
        ...value.copyAccountIds.filter((id) => id !== effectiveAccountId),
      ];
      const multiplier =
        value.market === "future" || value.market === "futures"
          ? multiplierForPreset(value.futuresPresetId)
          : value.market === "option"
            ? 100
            : 1;
      const initialRisk = (() => {
        const entry = weightedAvgEntry(parsedRows, value.side);
        if (!entry) return null;
        return computeInitialRisk(
          value.side,
          entry.avg,
          entry.qty,
          parseNum(value.stop),
          multiplier,
        );
      })();

      const executionRows = parsedRows.map((r) => ({
        symbol: value.symbol.toUpperCase(),
        instrument_type: value.market,
        side: r.side,
        quantity: r.quantity,
        price: r.price,
        fees: r.fees,
        commission: r.commission,
        executed_at: new Date(r.executed_at).toISOString(),
        multiplier,
      }));

      try {
        const { tradeIds } = await createExecutions.mutateAsync({
          accountIds,
          rows: executionRows,
        });

        const journalNotes = buildStructuredJournalNotes({
          session: value.session,
          entryReason: value.entryReason,
          exitReason: value.exitReason,
          reviewNotes: value.reviewNotes,
        });

        const patchBody = {
          notes: journalNotes,
          setup_id: value.setupIds[0] ?? "",
          setup_ids: value.setupIds,
          initial_risk: initialRisk ?? undefined,
          target_price: parseNum(value.target) ?? undefined,
          stop_price: parseNum(value.stop) ?? undefined,
          emotional_state: value.emotionalState || "",
          confidence: intFromGrade(value.setupGrade),
          trade_quality: intFromGrade(value.executionGrade),
          tag_ids: [...value.selectedTagIds, ...value.selectedMistakeIds],
        };

        for (const tradeId of tradeIds) {
          await tradesApi.patch(tradeId, patchBody);
        }

        const primaryTradeId = tradeIds[0];
        if (primaryTradeId && pendingFiles.length > 0) {
          for (const file of capScreenshots(pendingFiles, maxScreenshots)) {
            const fd = new FormData();
            fd.append("file", file);
            await attachmentsApi.upload(primaryTradeId, fd);
          }
        }

        const currency = accounts.find((a) => a.id === effectiveAccountId)?.base_currency ?? "USD";
        const divAmount = parseNum(value.dividendAmount);
        if (primaryTradeId && divAmount != null && divAmount > 0) {
          const signed = value.side === "short" ? -Math.abs(divAmount) : Math.abs(divAmount);
          await cashApi.create({
            account_id: effectiveAccountId,
            type: "dividend",
            amount: signed,
            currency,
            occurred_at: new Date(`${value.dividendDate}T12:00:00`).toISOString(),
            note: value.dividendNote || `${value.symbol.toUpperCase()} dividend`,
            trade_id: primaryTradeId,
          });
        }

        toast.add({
          title: "Trade logged",
          description: `${value.symbol.toUpperCase()} saved${value.copyAccountIds.length ? ` (+${value.copyAccountIds.length} copies)` : ""}.`,
        });
        close();
      } catch (e) {
        if (e instanceof ExecutionBatchError) {
          const message = e.failures
            .map((f) => `Row ${f.index + 1} (${f.accountId}): ${f.message}`)
            .join("; ");
          setSubmitError(message);
          toast.add({ title: "Could not log trade", description: message });
        } else {
          const message = e instanceof Error ? e.message : "Save failed";
          setSubmitError(message);
          toast.add({ title: "Could not log trade", description: message });
        }
      }
    },
  });

  const values = useStore(form.store, (s) => s.values);
  const {
    accountId,
    copyAccountIds,
    market,
    futuresPresetId,
    symbol,
    side,
    target,
    stop,
    rows,
    setupIds,
    session,
    emotionalState,
    setupGrade,
    executionGrade,
    selectedTagIds,
    selectedMistakeIds,
    entryReason,
    exitReason,
    reviewNotes,
    dividendAmount,
    dividendDate,
    dividendNote,
  } = values;

  const effectiveAccountId = accountId || filterAccountId || accounts[0]?.id || "";
  const currency = accounts.find((a) => a.id === effectiveAccountId)?.base_currency ?? "USD";
  const multiplier =
    market === "future" || market === "futures"
      ? multiplierForPreset(futuresPresetId)
      : market === "option"
        ? 100
        : 1;

  const wasOpen = useRef(false);

  function resetForm() {
    setTab("general");
    form.reset(defaultNewTradeFormValues());
    setPendingFiles([]);
    setOcrRawText("");
    setOcrWarnings([]);
    setShowOcrText(false);
    setSubmitError("");
    setTemplatesOpen(false);
    setCopyOpen(false);
  }

  function close() {
    resetForm();
    closeModal();
  }

  const consumeTradeDraft = useUI((s) => s.consumeTradeDraft);

  useEffect(() => {
    if (open && !wasOpen.current) {
      resetForm();
      setTemplates(listTradeTemplates());
      const draft = consumeTradeDraft();
      if (draft) {
        if (draft.symbol) form.setFieldValue("symbol", draft.symbol);
        if (draft.side) {
          form.setFieldValue("side", draft.side);
          form.setFieldValue("rows", [emptyExecutionRow(draft.side === "long" ? "buy" : "sell")]);
        }
        if (draft.target) form.setFieldValue("target", draft.target);
        if (draft.stop) form.setFieldValue("stop", draft.stop);
        if (draft.setupId) form.setFieldValue("setupIds", [draft.setupId]);
        if (draft.notes) {
          const parsed = parseJournalNotes(draft.notes);
          form.setFieldValue("session", parsed.session);
          form.setFieldValue("entryReason", parsed.entryReason || parsed.legacy);
          form.setFieldValue("exitReason", parsed.exitReason);
          form.setFieldValue("reviewNotes", parsed.reviewNotes);
        }
      }
    }
    wasOpen.current = open;
  }, [open, consumeTradeDraft]);

  function toggleId(list: string[], id: string, field: keyof NewTradeFormValues) {
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    form.setFieldValue(field, next as never);
  }

  /** Order-preserving toggle: first selected id is the main setup. */
  function toggleSetupId(id: string) {
    form.setFieldValue(
      "setupIds",
      setupIds.includes(id) ? setupIds.filter((x) => x !== id) : [...setupIds, id],
    );
  }

  function applyFuturesPreset(presetId: string) {
    form.setFieldValue("futuresPresetId", presetId);
    form.setFieldValue("market", "future");
    if (presetId !== CUSTOM_PRESET_ID) {
      const p = FUTURES_PRESETS.find((x) => x.id === presetId);
      if (p) form.setFieldValue("symbol", p.symbol);
    }
  }

  function applyOcrExtract(extract: TradeExtract) {
    if (extract.symbol) {
      const next = extract.symbol.toUpperCase();
      form.setFieldValue("symbol", next);
      if (extract.instrument_type === "future" || extract.instrument_type === "futures") {
        form.setFieldValue("futuresPresetId", presetIdForSymbol(next));
      }
    }
    if (extract.instrument_type) {
      const m = extract.instrument_type === "futures" ? "future" : extract.instrument_type;
      if (MARKETS.some((x) => x.value === m)) form.setFieldValue("market", m);
    }
    const nextSide: "long" | "short" =
      extract.side === "short" || extract.side === "long"
        ? extract.side
        : extract.rows?.[0]?.side === "sell"
          ? "short"
          : "long";
    if (extract.side === "long" || extract.side === "short" || (extract.rows?.length ?? 0) > 0) {
      form.setFieldValue("side", nextSide);
    }
    if (extract.rows?.length) {
      form.setFieldValue("rows", rowsFromOcrExtract(extract, nextSide));
    }
    setOcrRawText(extract.raw_text ?? "");
    setOcrWarnings(extract.warnings ?? []);
    setShowOcrText(false);
  }

  async function handleScanScreenshot(file: File) {
    // OCR only prefills the form — journal screenshots stay on the Journal tab.
    try {
      const extract = await ocrParse.mutateAsync(file);
      applyOcrExtract(extract);
      if (extract.confidence < 0.5) {
        toast.add({
          title: "Low OCR confidence",
          description: "Review the prefilled fields before saving.",
          type: "warning",
        });
      } else if ((extract.warnings?.length ?? 0) > 0) {
        toast.add({
          title: "Form prefilled",
          description: extract.warnings[0],
          type: "info",
        });
      } else {
        toast.add({
          title: "Form prefilled",
          description: "Review fields before saving. Attach screenshots on the Journal tab.",
          type: "success",
        });
      }
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not scan screenshot";
      toast.add({ title: "OCR failed", description: msg, type: "error" });
    }
  }

  function applyTemplate(t: TradeTemplate) {
    form.setFieldValue("market", t.market);
    form.setFieldValue("symbol", t.symbol);
    form.setFieldValue(
      "futuresPresetId",
      t.market === "future" || t.market === "futures"
        ? presetIdForSymbol(t.symbol)
        : CUSTOM_PRESET_ID,
    );
    form.setFieldValue("side", t.side);
    form.setFieldValue("target", t.target);
    form.setFieldValue("stop", t.stop);
    form.setFieldValue(
      "rows",
      t.rows.map((r) => ({
        ...r,
        commission:
          "commission" in r ? String((r as { commission?: string }).commission ?? "") : "",
        executed_at: nowLocalDatetime(),
      })),
    );
    form.setFieldValue("setupIds", t.setupId ? [t.setupId] : []);
    const parsed = parseJournalNotes(t.notes);
    form.setFieldValue("session", parsed.session);
    form.setFieldValue("entryReason", parsed.entryReason || parsed.legacy);
    form.setFieldValue("exitReason", parsed.exitReason);
    form.setFieldValue("reviewNotes", parsed.reviewNotes);
    form.setFieldValue("emotionalState", t.emotionalState);
    form.setFieldValue("setupGrade", gradeFromInt(t.confidence));
    form.setFieldValue("executionGrade", gradeFromInt(t.tradeQuality));
    form.setFieldValue("selectedTagIds", t.tagIds);
    form.setFieldValue("selectedMistakeIds", t.mistakeTagIds);
    setTemplatesOpen(false);
  }

  function handleSaveTemplate() {
    const name = window.prompt("Template name");
    if (!name?.trim()) return;
    saveTradeTemplate({
      name: name.trim(),
      market,
      symbol,
      side,
      target,
      stop,
      rows: rows.map(({ side, quantity, price, fees }) => ({
        side,
        quantity,
        price,
        fees,
      })),
      setupId: setupIds[0] ?? "",
      notes: buildStructuredJournalNotes({
        session,
        entryReason,
        exitReason,
        reviewNotes,
      }),
      emotionalState,
      confidence: intFromGrade(setupGrade) ?? 3,
      tradeQuality: intFromGrade(executionGrade) ?? 3,
      tagIds: selectedTagIds,
      mistakeTagIds: selectedMistakeIds,
    });
    setTemplates(listTradeTemplates());
    toast.add({ title: "Template saved", description: name.trim() });
  }

  const parsedRows = useMemo(() => parseTradeRows(rows), [rows]);

  const entry = useMemo(() => weightedAvgEntry(parsedRows, side), [parsedRows, side]);

  const initialRisk = useMemo(() => {
    if (!entry) return null;
    return computeInitialRisk(side, entry.avg, entry.qty, parseNum(stop), multiplier);
  }, [entry, side, stop, multiplier]);

  const pnlPreview = useMemo(
    () => previewTradePnl(side, parsedRows, multiplier, initialRisk),
    [side, parsedRows, multiplier, initialRisk],
  );

  function runCompliance() {
    const rules = riskRulesQ.data;
    const result = checkTradeCompliance({
      side,
      entryPrice: entry?.avg ?? null,
      qty: entry?.qty ?? null,
      targetPrice: parseNum(target),
      stopPrice: parseNum(stop),
      initialRisk,
      rules: rules
        ? {
            max_risk_per_trade: rules.max_risk_per_trade,
            max_daily_loss: rules.max_daily_loss,
            max_open_risk: rules.max_open_risk,
          }
        : undefined,
      todayNetPnl: todaySummaryQ.data?.net_pnl ?? null,
      openRiskTotal,
    });
    if (result.passed) {
      toast.add({
        title: "Compliance check passed",
        description: result.warnings.join(" ") || "Plan looks consistent with your risk rules.",
      });
    } else {
      toast.add({
        title: "Compliance issues found",
        description: [...result.issues, ...result.warnings].join(" "),
      });
    }
    setSubmitError(result.issues[0] ?? "");
  }

  function handleSave() {
    setSubmitError("");
    setTab("general");
    void form.handleSubmit();
  }

  const formSubmitError = useStore(form.store, (s) => s.errorMap.onSubmit);

  const otherAccounts = accounts.filter((a) => a.id !== effectiveAccountId);
  const pending = createExecutions.isPending;

  const menuItemClass = cn(
    "flex w-full cursor-pointer items-center gap-2 rounded-control px-2.5 py-2",
    "border-none bg-transparent text-left text-[12px] text-text outline-none",
    "transition-colors duration-100 hover:bg-bg-hover",
  );

  const headerActions = (
    <>
      <SignalPopover
        open={templatesOpen}
        onOpenChange={(next) => {
          setTemplatesOpen(next);
          if (next) {
            setTemplates(listTradeTemplates());
            setCopyOpen(false);
          }
        }}
        align="end"
        triggerAriaLabel="Templates"
        triggerClassName={cn(btnGhost, templatesOpen && "bg-bg-input-hover text-text")}
        className="min-w-[200px] p-0"
        trigger={
          <>
            <FileStack size={13} strokeWidth={1.5} aria-hidden />
            Templates
            <ChevronDown
              size={12}
              strokeWidth={1.5}
              className={cn(
                "shrink-0 text-text-dim transition-transform duration-150",
                templatesOpen && "rotate-180",
              )}
              aria-hidden
            />
          </>
        }
      >
        <div className={signalSelectListClass}>
          {templates.length === 0 ? (
            <p className="px-2.5 py-2 text-[12px] text-text-muted">No templates yet</p>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                type="button"
                className={menuItemClass}
                onClick={() => applyTemplate(t)}
              >
                {t.name}
              </button>
            ))
          )}
          <button
            type="button"
            className={cn(menuItemClass, "font-medium text-accent hover:bg-accent-bg")}
            onClick={handleSaveTemplate}
          >
            Save current as template…
          </button>
        </div>
      </SignalPopover>
      {otherAccounts.length > 0 && (
        <SignalPopover
          open={copyOpen}
          onOpenChange={(next) => {
            setCopyOpen(next);
            if (next) setTemplatesOpen(false);
          }}
          align="end"
          triggerAriaLabel="Save copies to"
          triggerClassName={cn(btnGhost, copyOpen && "bg-bg-input-hover text-text")}
          className="min-w-[200px] p-0"
          trigger={
            <>
              Save copies to
              <ChevronDown
                size={12}
                strokeWidth={1.5}
                className={cn(
                  "shrink-0 text-text-dim transition-transform duration-150",
                  copyOpen && "rotate-180",
                )}
                aria-hidden
              />
            </>
          }
        >
          <div className={signalSelectListClass}>
            {otherAccounts.map((a) => (
              <label
                key={a.id}
                className={cn(
                  menuItemClass,
                  "cursor-pointer",
                  copyAccountIds.includes(a.id) && "bg-accent-bg text-accent",
                )}
              >
                <input
                  type="checkbox"
                  checked={copyAccountIds.includes(a.id)}
                  onChange={() => toggleId(copyAccountIds, a.id, "copyAccountIds")}
                  className="size-3.5 accent-[var(--color-accent)]"
                />
                {a.name}
              </label>
            ))}
          </div>
        </SignalPopover>
      )}
    </>
  );

  const footer = (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex gap-2">
        <button type="button" className={btnPrimary} onClick={handleSave} disabled={pending}>
          Save
        </button>
        <button type="button" className={btnGhost} onClick={runCompliance} disabled={pending}>
          Check compliance
        </button>
      </div>
      <button type="button" className={btnGhost} onClick={close} disabled={pending}>
        Cancel
      </button>
    </div>
  );

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o && !pending) close();
      }}
      modal="trap-focus"
    >
      <DrawerContent
        style={
          {
            "--drawer-content-width": "min(792px, calc(100vw - 2 * var(--drawer-inset)))",
          } as CSSProperties
        }
      >
        <DrawerHeader>
          <DrawerTitle>New Trade</DrawerTitle>
          <div className="ml-auto flex items-center gap-2">
            {headerActions}
            <DrawerClose
              aria-label="Close"
              className={cn(
                "flex size-8 cursor-pointer items-center justify-center rounded-control border-none",
                "bg-bg-input text-text-muted transition-colors duration-150",
                "hover:bg-bg-input-hover hover:text-text",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              )}
            >
              <X size={14} strokeWidth={2} aria-hidden />
            </DrawerClose>
          </div>
        </DrawerHeader>
        <DrawerBody>
          <ModalBanner>
            Log any trade you've entered — still open, partially exited, or fully closed. Add
            buy/sell executions, journal notes, and run a compliance check against your risk plan.
          </ModalBanner>

          <form
            id="new-trade-form"
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <SegmentedControl
              ariaLabel="Trade form section"
              fullWidth
              size="md"
              options={[
                { value: "general", label: "General" },
                { value: "journal", label: "Journal" },
                { value: "dividends", label: "Dividends" },
              ]}
              value={tab}
              onChange={(v) => setTab(v as Tab)}
            />

            {tab === "general" && (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={labelClass}>OCR prefill</span>
                    <button
                      type="button"
                      disabled={ocrParse.isPending}
                      onClick={() => ocrFileRef.current?.click()}
                      className={cn(btnGhost, "inline-flex items-center gap-1.5")}
                      aria-label="Prefill trade from screenshot"
                    >
                      <ScanLine size={14} strokeWidth={1.5} aria-hidden />
                      {ocrParse.isPending ? "Scanning…" : "Scan to fill"}
                    </button>
                  </div>
                  <input
                    ref={ocrFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    data-testid="ocr-scan-input"
                    className="sr-only"
                    aria-hidden
                    tabIndex={-1}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void handleScanScreenshot(file);
                    }}
                  />
                  <p className="text-[10px] text-text-muted">
                    Reads a broker fill screenshot and fills symbol / side / qty / price. Does not
                    attach the image — use Journal → Screenshots for that.
                  </p>
                  {ocrWarnings.length > 0 && (
                    <ul className="space-y-0.5 text-[10px] text-text-muted">
                      {ocrWarnings.map((w) => (
                        <li key={w}>· {w}</li>
                      ))}
                    </ul>
                  )}
                  {ocrRawText ? (
                    <div>
                      <button
                        type="button"
                        className={cn(btnGhost, "text-[10px]")}
                        onClick={() => setShowOcrText((v) => !v)}
                      >
                        {showOcrText ? "Hide OCR text" : "Show OCR text"}
                      </button>
                      {showOcrText ? (
                        <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap rounded-control bg-bg-input px-2.5 py-2 text-[10px] text-text-muted">
                          {ocrRawText}
                        </pre>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className={labelClass} htmlFor="nt-account">
                      Account
                    </label>
                    <SignalSelect
                      id="nt-account"
                      value={effectiveAccountId}
                      onValueChange={(v) => form.setFieldValue("accountId", v)}
                      options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                      ariaLabel="Account"
                      triggerClassName="h-9 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="nt-market">
                      Market
                    </label>
                    <SignalSelect
                      id="nt-market"
                      value={market}
                      onValueChange={(v) => {
                        form.setFieldValue("market", v);
                        if (v === "future" || v === "futures") {
                          form.setFieldValue(
                            "futuresPresetId",
                            futuresPresetId === CUSTOM_PRESET_ID
                              ? presetIdForSymbol(symbol)
                              : futuresPresetId,
                          );
                        } else {
                          form.setFieldValue("futuresPresetId", CUSTOM_PRESET_ID);
                        }
                      }}
                      options={MARKETS}
                      ariaLabel="Market"
                      triggerClassName="h-9 text-[12px]"
                    />
                  </div>
                  {market === "future" || market === "futures" ? (
                    <div>
                      <label className={labelClass} htmlFor="nt-futures-preset">
                        Contract
                      </label>
                      <SignalSelect
                        id="nt-futures-preset"
                        value={futuresPresetId}
                        onValueChange={applyFuturesPreset}
                        options={[
                          ...FUTURES_PRESETS.map((p) => ({ value: p.id, label: p.label })),
                          { value: CUSTOM_PRESET_ID, label: "Custom" },
                        ]}
                        ariaLabel="Futures contract"
                        triggerClassName="h-9 text-[12px]"
                      />
                    </div>
                  ) : null}
                  <div>
                    <form.Field
                      name="symbol"
                      validators={{
                        onSubmit: ({ value }) => validateSymbol(value),
                        onBlur: ({ value }) => validateSymbol(value),
                      }}
                    >
                      {(field) => (
                        <SignalField
                          label="Symbol"
                          htmlFor="nt-symbol"
                          error={fieldError(field.state.meta.errors)}
                        >
                          <input
                            id="nt-symbol"
                            aria-label="Symbol"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => {
                              const next = e.target.value.toUpperCase();
                              field.handleChange(next);
                              if (market === "future" || market === "futures") {
                                form.setFieldValue("futuresPresetId", presetIdForSymbol(next));
                              }
                            }}
                            placeholder={
                              market === "future" || market === "futures" ? "NQ" : "AAPL"
                            }
                            className={inputClass}
                          />
                        </SignalField>
                      )}
                    </form.Field>
                  </div>
                  <div>
                    <span className={labelClass}>Side</span>
                    <SegmentedControl
                      ariaLabel="Side"
                      size="md"
                      options={[
                        { value: "long", label: "↗ LONG" },
                        { value: "short", label: "↘ SHORT" },
                      ]}
                      value={side}
                      onChange={(v) => {
                        const next = v as "long" | "short";
                        form.setFieldValue("side", next);
                        form.setFieldValue(
                          "rows",
                          rows.map((r, i) =>
                            i === 0
                              ? {
                                  ...r,
                                  side: next === "long" ? "buy" : "sell",
                                }
                              : r,
                          ),
                        );
                      }}
                    />
                  </div>
                </div>
                {(market === "future" || market === "futures") && multiplier !== 1 ? (
                  <p className="text-[10px] text-text-muted">
                    Point value ${multiplier}/pt applied to fills and risk.
                  </p>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <form.Field name="target">
                    {(field) => (
                      <SignalField label="Target" htmlFor="nt-target">
                        <SignalAmountInput
                          id="nt-target"
                          value={field.state.value}
                          onValueChange={field.handleChange}
                          onBlur={field.handleBlur}
                          placeholder="Optional"
                        />
                      </SignalField>
                    )}
                  </form.Field>
                  <form.Field name="stop">
                    {(field) => (
                      <SignalField label="Stop" htmlFor="nt-stop">
                        <SignalAmountInput
                          id="nt-stop"
                          value={field.state.value}
                          onValueChange={field.handleChange}
                          onBlur={field.handleBlur}
                          placeholder="Optional"
                        />
                      </SignalField>
                    )}
                  </form.Field>
                </div>

                {(initialRisk != null || pnlPreview.net != null) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-text-muted">
                    {initialRisk != null && <span>Planned risk: ${initialRisk.toFixed(2)}</span>}
                    {pnlPreview.net != null && (
                      <span>
                        Net PnL preview:{" "}
                        <span
                          className={
                            pnlPreview.net > 0
                              ? "text-pos"
                              : pnlPreview.net < 0
                                ? "text-loss"
                                : undefined
                          }
                        >
                          {fmtSignedMoney(pnlPreview.net, currency, intlLocale)}
                        </span>
                        {pnlPreview.rMultiple != null && <> · {pnlPreview.rMultiple.toFixed(2)}R</>}
                      </span>
                    )}
                  </div>
                )}

                <form.Field name="rows" mode="array">
                  {(rowsField) => (
                    <div className="flex flex-col gap-2">
                      <div
                        className="grid gap-2 text-[10px] font-medium uppercase tracking-widest text-text-muted"
                        style={{
                          gridTemplateColumns: FILL_ROW_COLS,
                        }}
                      >
                        <span>Action</span>
                        <span>Date / Time</span>
                        <span>Qty</span>
                        <span>Price</span>
                        <span>Fee</span>
                        <span>Comm</span>
                        <span />
                      </div>
                      {rowsField.state.value.map((row, i) => (
                        <div
                          key={i}
                          className="grid items-center gap-2"
                          style={{
                            gridTemplateColumns: FILL_ROW_COLS,
                          }}
                        >
                          <button
                            type="button"
                            aria-label={`Toggle action row ${i + 1}`}
                            onClick={() =>
                              form.setFieldValue(
                                `rows[${i}].side`,
                                row.side === "buy" ? "sell" : "buy",
                              )
                            }
                            className={cn(
                              "flex h-10 cursor-pointer items-center justify-center rounded-control border-none px-3 text-[12px] font-bold",
                              row.side === "buy"
                                ? "bg-[var(--tint-pos)] text-pos"
                                : "bg-[var(--tint-neg)] text-loss",
                            )}
                          >
                            {row.side.toUpperCase()}
                          </button>
                          <form.Field name={`rows[${i}].executed_at`}>
                            {(field) => (
                              <SignalDateTimePicker
                                aria-label={`Date/time row ${i + 1}`}
                                value={field.state.value}
                                onChange={field.handleChange}
                                onBlur={field.handleBlur}
                              />
                            )}
                          </form.Field>
                          <form.Field
                            name={`rows[${i}].quantity`}
                            validators={{
                              onBlur: ({ value }) => validatePositiveAmount(value, "Qty"),
                              onSubmit: ({ value }) => validatePositiveAmount(value, "Qty"),
                            }}
                          >
                            {(field) => (
                              <div className="min-w-0">
                                <SignalAmountInput
                                  aria-label={`Qty row ${i + 1}`}
                                  placeholder="Qty"
                                  value={field.state.value}
                                  onValueChange={field.handleChange}
                                  onBlur={field.handleBlur}
                                  aria-invalid={!field.state.meta.isValid}
                                />
                                {fieldError(field.state.meta.errors) ? (
                                  <p className={cn("mt-0.5 truncate", signalFieldErrorClass)}>
                                    {fieldError(field.state.meta.errors)}
                                  </p>
                                ) : null}
                              </div>
                            )}
                          </form.Field>
                          <form.Field
                            name={`rows[${i}].price`}
                            validators={{
                              onBlur: ({ value }) => validatePositiveAmount(value, "Price"),
                              onSubmit: ({ value }) => validatePositiveAmount(value, "Price"),
                            }}
                          >
                            {(field) => (
                              <div className="min-w-0">
                                <SignalAmountInput
                                  aria-label={`Price row ${i + 1}`}
                                  placeholder="Price"
                                  value={field.state.value}
                                  onValueChange={field.handleChange}
                                  onBlur={field.handleBlur}
                                  aria-invalid={!field.state.meta.isValid}
                                />
                                {fieldError(field.state.meta.errors) ? (
                                  <p className={cn("mt-0.5 truncate", signalFieldErrorClass)}>
                                    {fieldError(field.state.meta.errors)}
                                  </p>
                                ) : null}
                              </div>
                            )}
                          </form.Field>
                          <form.Field
                            name={`rows[${i}].fees`}
                            validators={{
                              onBlur: ({ value }) => validateNonNegativeAmount(value, "Fee"),
                              onSubmit: ({ value }) => validateNonNegativeAmount(value, "Fee"),
                            }}
                          >
                            {(field) => (
                              <SignalAmountInput
                                aria-label={`Fee row ${i + 1}`}
                                placeholder="Fee"
                                value={field.state.value}
                                onValueChange={field.handleChange}
                                onBlur={field.handleBlur}
                                compact
                              />
                            )}
                          </form.Field>
                          <form.Field
                            name={`rows[${i}].commission`}
                            validators={{
                              onBlur: ({ value }) => validateNonNegativeAmount(value, "Comm"),
                              onSubmit: ({ value }) => validateNonNegativeAmount(value, "Comm"),
                            }}
                          >
                            {(field) => (
                              <SignalAmountInput
                                aria-label={`Commission row ${i + 1}`}
                                placeholder="Comm"
                                value={field.state.value}
                                onValueChange={field.handleChange}
                                onBlur={field.handleBlur}
                                compact
                              />
                            )}
                          </form.Field>
                          <button
                            type="button"
                            aria-label={`Remove row ${i + 1}`}
                            disabled={rowsField.state.value.length === 1}
                            onClick={() => rowsField.removeValue(i)}
                            className={cn(
                              "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none",
                              "bg-bg-input text-text-muted transition-colors duration-150",
                              "hover:bg-bg-input-hover hover:text-text",
                              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                              "disabled:cursor-not-allowed disabled:opacity-40",
                            )}
                          >
                            <X size={12} strokeWidth={2} aria-hidden />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        aria-label="Add execution row"
                        onClick={() =>
                          rowsField.pushValue(emptyExecutionRow(side === "long" ? "buy" : "sell"))
                        }
                        className="mx-auto mt-1 flex size-9 cursor-pointer items-center justify-center rounded-control border-none bg-accent text-bg transition-opacity hover:opacity-90"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </form.Field>
              </>
            )}

            {tab === "journal" && (
              <div className="flex flex-col gap-4">
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
                        const idx = setupIds.indexOf(s.id);
                        const on = idx >= 0;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleSetupId(s.id)}
                            className="cursor-pointer border-none bg-transparent p-0"
                            aria-pressed={on}
                          >
                            <Pill tone={on ? "accent" : "muted"}>
                              {on && idx === 0 ? `${s.name} · main` : s.name}
                            </Pill>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <span className={labelClass}>Session</span>
                  <div className="flex flex-wrap gap-1.5">
                    {TRADE_SESSIONS.map((s) => {
                      const on = session === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => form.setFieldValue("session", on ? "" : s)}
                          className={cn(
                            "cursor-pointer rounded-control border-none px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.02em] transition-colors",
                            on
                              ? "bg-accent-bg text-accent"
                              : "bg-bg-hover text-text-muted hover:bg-bg-input-hover hover:text-text",
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="nt-emotion">
                    Emotion
                  </label>
                  <SignalSelect
                    id="nt-emotion"
                    value={emotionalState}
                    onValueChange={(v) => form.setFieldValue("emotionalState", v)}
                    options={[
                      { value: "", label: "Not set" },
                      ...EMOTIONAL_STATES.map((s) => ({ value: s, label: s })),
                    ]}
                    ariaLabel="Emotion"
                    triggerClassName="h-9 text-[12px]"
                  />
                </div>
                {regularTags.length > 0 && (
                  <div>
                    <span className={labelClass}>Tags</span>
                    <div className="flex flex-wrap gap-1.5">
                      {regularTags.map((t) => {
                        const on = selectedTagIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleId(selectedTagIds, t.id, "selectedTagIds")}
                            className="cursor-pointer border-none bg-transparent p-0"
                          >
                            <Pill tone={on ? "accent" : "muted"}>{t.name}</Pill>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {mistakeTags.length > 0 && (
                  <div>
                    <span className={labelClass}>Mistake type</span>
                    <p className="mb-2 text-[10px] text-text-muted">
                      Optional — tap any that apply.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {mistakeTags.map((t) => {
                        const on = selectedMistakeIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleId(selectedMistakeIds, t.id, "selectedMistakeIds")}
                            className="cursor-pointer border-none bg-transparent p-0"
                          >
                            <Pill tone={on ? "neg" : "muted"}>{t.name}</Pill>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <GradeControl
                  label="Setup rating"
                  hint="Rate the setup itself — ignore PnL and emotion."
                  value={setupGrade}
                  onChange={(v) => form.setFieldValue("setupGrade", v)}
                />
                <GradeControl
                  label="Execution rating"
                  hint="Rate your execution — patience, timing, stop discipline."
                  value={executionGrade}
                  onChange={(v) => form.setFieldValue("executionGrade", v)}
                />
                <div>
                  <label className={labelClass} htmlFor="nt-entry-reason">
                    Entry reason
                  </label>
                  <SignalTextarea
                    id="nt-entry-reason"
                    value={entryReason}
                    onChange={(e) => form.setFieldValue("entryReason", e.target.value)}
                    rows={2}
                    placeholder="Why did you enter?"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="nt-exit-reason">
                    Exit reason
                  </label>
                  <SignalTextarea
                    id="nt-exit-reason"
                    value={exitReason}
                    onChange={(e) => form.setFieldValue("exitReason", e.target.value)}
                    rows={2}
                    placeholder="Why did you exit?"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="nt-review">
                    Review notes
                  </label>
                  <SignalTextarea
                    id="nt-review"
                    value={reviewNotes}
                    onChange={(e) => form.setFieldValue("reviewNotes", e.target.value)}
                    rows={3}
                    placeholder="What would you do differently?"
                  />
                </div>
                <div>
                  <span className={labelClass}>
                    Screenshots
                    {pendingFiles.length > 0
                      ? maxScreenshots != null
                        ? ` (${pendingFiles.length}/${maxScreenshots})`
                        : ` (${pendingFiles.length})`
                      : maxScreenshots != null
                        ? ` (max ${maxScreenshots})`
                        : ""}
                  </span>
                  <JournalScreenshotUpload
                    className="mt-1"
                    items={pendingFiles.map((file, index) =>
                      fileToScreenshotItem(file, () =>
                        setPendingFiles((prev) => prev.filter((_, i) => i !== index)),
                      ),
                    )}
                    onAddFiles={(incoming) =>
                      setPendingFiles((prev) =>
                        capScreenshots([...prev, ...incoming], maxScreenshots),
                      )
                    }
                    maxCount={maxScreenshots}
                  />
                </div>
              </div>
            )}

            {tab === "dividends" && (
              <div className="flex flex-col gap-4">
                <p className="text-xs leading-relaxed text-text-muted">
                  Track dividend payouts on this position. Amount rolls into trade total P&amp;L
                  (shorts are recorded as a debit). Win/Loss and R stay price-based.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <SignalField label={`Amount (${currency})`} htmlFor="nt-div-amt">
                    <SignalAmountInput
                      id="nt-div-amt"
                      value={dividendAmount}
                      onValueChange={(v) => form.setFieldValue("dividendAmount", v)}
                      placeholder="0.00"
                    />
                  </SignalField>
                  <SignalField label="Date">
                    <SignalDatePicker
                      id="nt-div-date"
                      aria-label="Date"
                      value={dividendDate}
                      onChange={(v) => form.setFieldValue("dividendDate", v)}
                    />
                  </SignalField>
                </div>
                <SignalField label="Note" htmlFor="nt-div-note">
                  <SignalInput
                    id="nt-div-note"
                    value={dividendNote}
                    onChange={(e) => form.setFieldValue("dividendNote", e.target.value)}
                    placeholder="Optional"
                  />
                </SignalField>
              </div>
            )}

            {(formSubmitError || submitError) && (
              <p className="text-xs text-loss">{formSubmitError ?? submitError}</p>
            )}
          </form>
        </DrawerBody>
        <DrawerFooter>{footer}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
