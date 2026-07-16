import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card } from "../../components/Card";
import { TradeChartSection } from "../../components/charts/TradeChartSection";
import { EmptyState } from "../../components/EmptyState";
import { Modal } from "../../components/Modal";
import { Page } from "../../components/Page";
import { Pill, type PillTone } from "../../components/Pill";
import { RiskRewardPanel } from "../../components/RiskRewardPanel";
import { SignalDateTimePicker } from "../../components/SignalDateTimePicker";
import { SignalField } from "../../components/SignalField";
import { SignalInput, SignalTextarea } from "../../components/SignalInput";
import { SignalSelect } from "../../components/SignalSelect";
import { JournalScreenshotUpload } from "../../components/JournalScreenshotUpload";
import { Skeleton } from "../../components/Skeleton";
import { GradeControl } from "../../components/GradeControl";
import { heroPnlClass, pnlColor } from "../../components/theme-tokens";
import { cn } from "../../lib/cn";
import { getToken } from "../../lib/api/client";
import type { Execution, Setup, Tag, TradeAttachment, TradeDetail } from "../../lib/api/types";
import { fmtDuration, fmtMoney, fmtSignedMoney } from "../../lib/format";
import {
  buildStructuredJournalNotes,
  EMOTIONAL_STATES,
  parseJournalNotes,
} from "../../lib/newTradeJournal";
import { intlLocale } from "../../lib/locale";
import { computeRiskReward } from "../../lib/riskReward";
import { gradeFromInt, intFromGrade, TRADE_SESSIONS, type TradeGrade } from "../../lib/tradeGrades";
import { usePrivacyMode } from "../../lib/displayPrefs";

function tradeOutcome(trade: TradeDetail): { label: string; tone: PillTone } {
  if (trade.status !== "closed") return { label: "OPEN", tone: "accent" };
  if (trade.net_pnl == null || trade.net_pnl === 0) return { label: "FLAT", tone: "muted" };
  return trade.net_pnl > 0 ? { label: "WIN", tone: "pos" } : { label: "LOSS", tone: "neg" };
}

const primaryButtonClass = cn(
  "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-control px-3",
  "text-[11px] font-medium text-accent transition-colors duration-150",
  "bg-accent-bg hover:bg-accent-bg/80 hover:text-text",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  "disabled:cursor-not-allowed disabled:opacity-55",
);

const ghostButtonClass = cn(
  "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-control px-3",
  "text-[11px] font-medium text-text-muted transition-colors duration-150",
  "bg-bg-hover hover:bg-bg-hover/80 hover:text-text",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  "disabled:cursor-not-allowed disabled:opacity-55",
);

const dangerButtonClass = cn(
  "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-control px-3",
  "text-[11px] font-medium text-loss transition-colors duration-150",
  "border border-loss/40 bg-transparent hover:bg-loss/10",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  "disabled:cursor-not-allowed disabled:opacity-55",
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(intlLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(intlLocale(), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-14 flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <span className="text-sm tabular-nums text-text">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthedImage
// ---------------------------------------------------------------------------

interface AuthedImageProps {
  attachmentId: string;
  filename: string;
}

function AuthedImage({ attachmentId, filename }: AuthedImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    const t = getToken();
    const BASE = (import.meta.env.VITE_API as string) ?? "/api/v1";
    fetch(`${BASE}/attachments/${attachmentId}/file`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => setError(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId]);

  if (error) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-sharp bg-bg-hover px-2 text-center text-xs text-text-muted">
        {filename}
      </div>
    );
  }

  if (!src) {
    return <Skeleton height="120px" />;
  }

  return (
    <img src={src} alt={filename} className="aspect-video w-full rounded-sharp object-cover" />
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function TradeHeader({ trade }: { trade: TradeDetail }) {
  usePrivacyMode();
  const currency = trade.pnl_currency;
  const pnl = trade.net_pnl;
  const rMultiple = trade.r_multiple;
  const returnPct = trade.return_pct;
  const outcome = tradeOutcome(trade);
  const hasDividends = trade.dividend_total != null && trade.dividend_total !== 0;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[28px] font-semibold leading-none tracking-[-0.03em] text-text">
            {trade.symbol}
          </span>
          <Pill tone={trade.direction === "long" ? "pos" : "neg"}>{trade.direction}</Pill>
          <Pill tone={outcome.tone}>{outcome.label}</Pill>
          <span className="text-xs uppercase tracking-wide text-text-muted">
            {trade.instrument_type}
          </span>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {pnl != null && (
            <span
              className={cn(heroPnlClass(pnl), "text-[28px]!")}
              title="Price P&L (excludes dividends)"
            >
              {fmtSignedMoney(pnl, currency, intlLocale())}
            </span>
          )}
          <div className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1">
            {returnPct != null && (
              <span className={cn("text-sm tabular-nums", pnlColor(returnPct))}>
                {returnPct >= 0 ? "+" : ""}
                {returnPct.toFixed(2)}%
              </span>
            )}
            {rMultiple != null && (
              <span
                className={cn("text-sm tabular-nums", pnlColor(rMultiple))}
                title="R-multiple (price-based)"
              >
                {rMultiple >= 0 ? "+" : ""}
                {rMultiple.toFixed(2)}R
              </span>
            )}
            {hasDividends && (
              <span
                className="text-sm tabular-nums text-text-muted"
                title="Dividends linked to this trade"
              >
                Div {fmtSignedMoney(trade.dividend_total!, currency, intlLocale())}
              </span>
            )}
            {hasDividends && trade.total_pnl != null && (
              <span
                className={cn("text-sm tabular-nums", pnlColor(trade.total_pnl))}
                title="Total = price P&L + dividends"
              >
                Total {fmtSignedMoney(trade.total_pnl, currency, intlLocale())}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
        <MetaStat label="Opened" value={fmtDate(trade.opened_at)} />
        <MetaStat label="Closed" value={fmtDate(trade.closed_at)} />
        <MetaStat label="Held" value={fmtDuration(trade.time_in_trade_secs)} />
        <MetaStat label="Qty" value={String(trade.qty_opened)} />
        <MetaStat label="Entry" value={fmtMoney(trade.avg_entry_price, currency, intlLocale())} />
        {trade.avg_exit_price != null && (
          <MetaStat label="Exit" value={fmtMoney(trade.avg_exit_price, currency, intlLocale())} />
        )}
        <MetaStat label="Fees" value={fmtMoney(trade.fees_total, currency, intlLocale())} />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Fills table
// ---------------------------------------------------------------------------

interface FillsTableProps {
  fills: Execution[];
  currency: string;
  mutating?: boolean;
  onEditFill?: (fill: Execution, input: AddFillInput) => void;
  onDeleteFill?: (fill: Execution) => void;
}

function FillsTable({
  fills,
  currency,
  mutating = false,
  onEditFill,
  onDeleteFill,
}: FillsTableProps) {
  usePrivacyMode();
  const [editing, setEditing] = useState<Execution | null>(null);
  const [deleting, setDeleting] = useState<Execution | null>(null);
  const canMutate = Boolean(onEditFill || onDeleteFill);

  if (fills.length === 0) {
    return <EmptyState title="No fills" hint="Executions will appear here once imported." />;
  }

  return (
    <>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {["Side", "Qty", "Price", "Fees", "Executed", ...(canMutate ? [""] : [])].map((h) => (
                <th
                  key={h || "actions"}
                  className="px-4 py-2 text-left text-label font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fills.map((fill) => (
              <tr key={fill.id} className="h-10 transition-colors duration-150 hover:bg-bg-hover">
                <td
                  className={cn(
                    "px-4 py-2 font-medium uppercase",
                    fill.side === "buy" ? "text-profit" : "text-loss",
                  )}
                >
                  {fill.side.toUpperCase()}
                </td>
                <td className="px-4 py-2 tabular-nums text-text">{fill.quantity}</td>
                <td className="px-4 py-2 tabular-nums text-text">
                  {fmtMoney(fill.price, currency, intlLocale())}
                </td>
                <td className="px-4 py-2 tabular-nums text-text-muted">
                  {fmtMoney(fill.fees + fill.commission, currency, intlLocale())}
                </td>
                <td className="px-4 py-2 tabular-nums whitespace-nowrap text-text-muted">
                  {fmtDateTime(fill.executed_at)}
                </td>
                {canMutate ? (
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                      {onEditFill && (
                        <button
                          type="button"
                          aria-label={`Edit ${fill.side} fill`}
                          title="Edit fill"
                          disabled={mutating}
                          onClick={() => setEditing(fill)}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-control text-text-muted transition-colors hover:bg-bg-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          <Pencil size={13} strokeWidth={1.5} aria-hidden />
                        </button>
                      )}
                      {onDeleteFill && (
                        <button
                          type="button"
                          aria-label={`Delete ${fill.side} fill`}
                          title="Delete fill"
                          disabled={mutating}
                          onClick={() => setDeleting(fill)}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-control text-text-muted transition-colors hover:bg-bg-hover hover:text-loss disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          <Trash2 size={13} strokeWidth={1.5} aria-hidden />
                        </button>
                      )}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && onEditFill && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          title="Edit fill"
          className="max-w-[min(560px,94vw)]"
          footer={
            <div className="flex w-full justify-end gap-2">
              <button
                type="button"
                className={ghostButtonClass}
                disabled={mutating}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-fill-form"
                disabled={mutating}
                className={primaryButtonClass}
              >
                {mutating ? "Saving…" : "Save fill"}
              </button>
            </div>
          }
        >
          <FillForm
            formId="edit-fill-form"
            initial={editing}
            busy={mutating}
            onSubmit={(input) => {
              onEditFill(editing, input);
              setEditing(null);
            }}
          />
        </Modal>
      )}

      {deleting && onDeleteFill && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
          title="Delete fill?"
          className="max-w-[min(420px,94vw)]"
          footer={
            <div className="flex w-full justify-end gap-2">
              <button
                type="button"
                className={ghostButtonClass}
                disabled={mutating}
                onClick={() => setDeleting(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={mutating}
                className={dangerButtonClass}
                onClick={() => {
                  onDeleteFill(deleting);
                  setDeleting(null);
                }}
              >
                {mutating ? "Deleting…" : "Delete"}
              </button>
            </div>
          }
        >
          <p className="m-0 text-xs leading-relaxed text-text-muted">
            Removes this {deleting.side.toUpperCase()} {deleting.quantity} @{" "}
            {fmtMoney(deleting.price, currency, intlLocale())} fill and regroups the position. This
            cannot be undone.
          </p>
        </Modal>
      )}
    </>
  );
}

export interface AddFillInput {
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  commission: number;
  executed_at: string;
}

function toLocalInputValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function FillForm({
  formId,
  initial,
  defaultSide = "buy",
  busy,
  onSubmit,
  submitLabel,
}: {
  formId?: string;
  initial?: Execution;
  defaultSide?: "buy" | "sell";
  busy: boolean;
  onSubmit: (input: AddFillInput) => void;
  submitLabel?: string;
}) {
  const [side, setSide] = useState<"buy" | "sell">(
    (initial?.side === "sell" ? "sell" : initial?.side === "buy" ? "buy" : defaultSide) as
      | "buy"
      | "sell",
  );
  const [qty, setQty] = useState(initial ? String(initial.quantity) : "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [fees, setFees] = useState(initial ? String(initial.fees) : "0");
  const [commission, setCommission] = useState(initial ? String(initial.commission) : "0");
  const [at, setAt] = useState(
    initial ? toLocalInputValue(new Date(initial.executed_at)) : toLocalInputValue(),
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const quantity = Number.parseFloat(qty);
    const px = Number.parseFloat(price);
    const fee = Number.parseFloat(fees) || 0;
    const comm = Number.parseFloat(commission) || 0;
    if (!(quantity > 0) || !(px >= 0)) return;
    onSubmit({
      side,
      quantity,
      price: px,
      fees: fee,
      commission: comm,
      executed_at: new Date(at).toISOString(),
    });
    if (!initial) {
      setQty("");
      setPrice("");
      setFees("0");
      setCommission("0");
    }
  }

  const sideId = formId ? `${formId}-side` : "fill-side";
  const qtyId = formId ? `${formId}-qty` : "fill-qty";
  const priceId = formId ? `${formId}-price` : "fill-price";
  const feeId = formId ? `${formId}-fee` : "fill-fee";
  const commissionId = formId ? `${formId}-commission` : "fill-commission";
  const atId = formId ? `${formId}-at` : "fill-at";

  return (
    <form id={formId} onSubmit={submit} className={formId ? undefined : "px-4 pt-4 pb-4"}>
      {!formId && <p className="mb-3 text-label font-semibold text-text-muted">Add fill</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SignalField label="Side" htmlFor={sideId}>
          <SignalSelect
            id={sideId}
            value={side}
            onValueChange={(v) => setSide(v as "buy" | "sell")}
            options={[
              { value: "buy", label: "BUY" },
              { value: "sell", label: "SELL" },
            ]}
            ariaLabel="Fill side"
            triggerClassName="text-[13px]"
          />
        </SignalField>
        <SignalField label="Qty" htmlFor={qtyId}>
          <SignalInput
            id={qtyId}
            aria-label="Fill qty"
            type="number"
            step="any"
            min="0"
            placeholder="100"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
          />
        </SignalField>
        <SignalField label="Price" htmlFor={priceId}>
          <SignalInput
            id={priceId}
            aria-label="Fill price"
            type="number"
            step="any"
            min="0"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </SignalField>
        <SignalField label="Fee" htmlFor={feeId}>
          <SignalInput
            id={feeId}
            aria-label="Fill fee"
            type="number"
            step="any"
            min="0"
            placeholder="0.00"
            value={fees}
            onChange={(e) => setFees(e.target.value)}
          />
        </SignalField>
        <SignalField label="Commission" htmlFor={commissionId}>
          <SignalInput
            id={commissionId}
            aria-label="Fill commission"
            type="number"
            step="any"
            min="0"
            placeholder="0.00"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
          />
        </SignalField>
        <SignalField label="Executed" htmlFor={atId}>
          <SignalDateTimePicker id={atId} aria-label="Fill datetime" value={at} onChange={setAt} />
        </SignalField>
      </div>
      {!formId && (
        <button type="submit" disabled={busy} className={cn(primaryButtonClass, "mt-3")}>
          {busy ? "Adding…" : (submitLabel ?? "Add fill")}
        </button>
      )}
    </form>
  );
}

function AddFillForm({
  defaultSide,
  busy,
  onSubmit,
}: {
  defaultSide: "buy" | "sell";
  busy: boolean;
  onSubmit: (input: AddFillInput) => void;
}) {
  return <FillForm defaultSide={defaultSide} busy={busy} onSubmit={onSubmit} />;
}

// ---------------------------------------------------------------------------
// Journal panel
// ---------------------------------------------------------------------------

export function journalDraftKey(tradeId: string): string {
  return `tm_draft_trade_${tradeId}`;
}

export interface JournalFormState {
  notes: string;
  session: string;
  entry_reason: string;
  exit_reason: string;
  review_notes: string;
  /** @deprecated Prefer setup_ids; kept as first selected for draft compat. */
  setup_id: string;
  /** Ordered setup ids; first is main. */
  setup_ids: string[];
  initial_risk: string;
  target_price: string;
  stop_price: string;
  emotional_state: string;
  confidence: string;
  trade_quality: string;
  mae: string;
  mfe: string;
  tag_ids: string[];
}

function RatingField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const grade = gradeFromInt(value ? Number(value) : null);
  return (
    <GradeControl
      label={label}
      hint={hint}
      value={grade}
      onChange={(g: TradeGrade | "") => {
        const n = intFromGrade(g);
        onChange(n != null ? String(n) : "");
      }}
    />
  );
}

function normalizeSetupIds(form: Pick<JournalFormState, "setup_id" | "setup_ids">): string[] {
  if (Array.isArray(form.setup_ids) && form.setup_ids.length > 0) {
    return form.setup_ids;
  }
  if (form.setup_id) return [form.setup_id];
  return form.setup_ids ?? [];
}

/** Backfill structured journal fields from freeform/structured markdown notes. */
export function hydrateJournalForm(form: JournalFormState): JournalFormState {
  const session = form.session ?? "";
  const entry_reason = form.entry_reason ?? "";
  const exit_reason = form.exit_reason ?? "";
  const review_notes = form.review_notes ?? "";
  const setup_ids = normalizeSetupIds(form);
  const setup_id = setup_ids[0] ?? "";
  const hasStructured = Boolean(session || entry_reason || exit_reason || review_notes);
  if (hasStructured || !form.notes?.trim()) {
    return {
      ...form,
      session,
      entry_reason,
      exit_reason,
      review_notes,
      setup_id,
      setup_ids,
    };
  }
  const parsed = parseJournalNotes(form.notes);
  return {
    ...form,
    session: parsed.session,
    entry_reason: parsed.entryReason,
    exit_reason: parsed.exitReason,
    review_notes: parsed.reviewNotes || parsed.legacy,
    setup_id,
    setup_ids,
  };
}

function withBuiltNotes(form: JournalFormState): JournalFormState {
  return {
    ...form,
    notes: buildStructuredJournalNotes({
      session: form.session,
      entryReason: form.entry_reason,
      exitReason: form.exit_reason,
      reviewNotes: form.review_notes,
    }),
  };
}

function TagChipGroup({
  tags,
  selected,
  onToggle,
  tone,
}: {
  tags: Tag[];
  selected: string[];
  onToggle: (id: string) => void;
  tone: "accent" | "neg";
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const active = selected.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(tag.id)}
            className={cn(
              "h-7 cursor-pointer rounded-control border px-2.5 text-[11px] font-medium transition-colors duration-150",
              active
                ? tone === "accent"
                  ? "border-accent/40 bg-accent-bg text-accent"
                  : "border-loss/40 bg-tint-neg text-loss"
                : "border-border bg-transparent text-text-muted hover:bg-bg-hover hover:text-text",
            )}
          >
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}

export interface JournalPanelProps {
  tradeId: string;
  initialState: JournalFormState;
  setups: Setup[];
  customTags: Tag[];
  mistakeTags: Tag[];
  saving: boolean;
  onSave: (state: JournalFormState) => void;
}

export function JournalPanel({
  tradeId,
  initialState,
  setups,
  customTags,
  mistakeTags,
  saving,
  onSave,
}: JournalPanelProps) {
  const seeded = hydrateJournalForm(initialState);
  const [form, setForm] = useState<JournalFormState>(seeded);

  const prevInitial = useRef(seeded);
  useEffect(() => {
    const next = hydrateJournalForm(initialState);
    if (
      prevInitial.current.notes !== next.notes ||
      prevInitial.current.session !== next.session ||
      prevInitial.current.entry_reason !== next.entry_reason ||
      prevInitial.current.exit_reason !== next.exit_reason ||
      prevInitial.current.review_notes !== next.review_notes ||
      prevInitial.current.setup_id !== next.setup_id ||
      JSON.stringify(prevInitial.current.setup_ids) !== JSON.stringify(next.setup_ids) ||
      prevInitial.current.initial_risk !== next.initial_risk ||
      prevInitial.current.target_price !== next.target_price ||
      prevInitial.current.stop_price !== next.stop_price ||
      prevInitial.current.emotional_state !== next.emotional_state ||
      prevInitial.current.confidence !== next.confidence ||
      prevInitial.current.trade_quality !== next.trade_quality ||
      prevInitial.current.mae !== next.mae ||
      prevInitial.current.mfe !== next.mfe ||
      JSON.stringify(prevInitial.current.tag_ids) !== JSON.stringify(next.tag_ids)
    ) {
      setForm(next);
      prevInitial.current = next;
    }
  }, [initialState]);

  const [draftRestored, setDraftRestored] = useState(false);
  const seededForDraftRef = useRef(seeded);
  seededForDraftRef.current = seeded;

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per trade
  useEffect(() => {
    try {
      const raw = localStorage.getItem(journalDraftKey(tradeId));
      if (!raw) return;
      const draft = JSON.parse(raw) as { at: number; form: JournalFormState };
      const draftForm = hydrateJournalForm(draft.form);
      if (JSON.stringify(draftForm) !== JSON.stringify(seededForDraftRef.current)) {
        setForm(draftForm);
        setDraftRestored(true);
      } else {
        localStorage.removeItem(journalDraftKey(tradeId));
      }
    } catch {
      /* corrupt draft — ignore */
    }
  }, [tradeId]);

  useEffect(() => {
    if (JSON.stringify(form) === JSON.stringify(seeded)) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(journalDraftKey(tradeId), JSON.stringify({ at: Date.now(), form }));
      } catch {
        /* storage full/unavailable — ignore */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [form, seeded, tradeId]);

  function discardDraft() {
    setForm(seeded);
    setDraftRestored(false);
    try {
      localStorage.removeItem(journalDraftKey(tradeId));
    } catch {
      /* ignore */
    }
  }

  function toggleTag(id: string) {
    setForm((f) => ({
      ...f,
      tag_ids: f.tag_ids.includes(id) ? f.tag_ids.filter((t) => t !== id) : [...f.tag_ids, id],
    }));
  }

  function toggleSetup(id: string) {
    setForm((f) => {
      const setup_ids = f.setup_ids.includes(id)
        ? f.setup_ids.filter((x) => x !== id)
        : [...f.setup_ids, id];
      return { ...f, setup_ids, setup_id: setup_ids[0] ?? "" };
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {draftRestored && (
        <div className="flex items-center justify-between gap-3 rounded-control bg-bg-hover px-3 py-2">
          <span className="text-[11px] text-text-muted">Unsaved draft restored.</span>
          <button
            type="button"
            onClick={discardDraft}
            className="cursor-pointer text-[11px] text-accent hover:underline"
          >
            Discard draft
          </button>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-text-muted">
          Setups (select multiple)
        </p>
        <p className="mb-2 text-[10px] text-text-muted">
          First selected setup becomes the main setup.
        </p>
        {setups.length === 0 ? (
          <p className="text-[11px] text-text-muted">No setups yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {setups.map((s) => {
              const idx = form.setup_ids.indexOf(s.id);
              const on = idx >= 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSetup(s.id)}
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
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-text-muted">
          Session
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TRADE_SESSIONS.map((s) => {
            const on = form.session === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setForm((f) => ({ ...f, session: on ? "" : s }))}
                className="cursor-pointer border-none bg-transparent p-0"
              >
                <Pill tone={on ? "accent" : "muted"}>{s}</Pill>
              </button>
            );
          })}
        </div>
      </div>

      <SignalField label="Emotion" htmlFor="trade-emotion">
        <SignalSelect
          id="trade-emotion"
          value={form.emotional_state}
          onValueChange={(emotional_state) => setForm((f) => ({ ...f, emotional_state }))}
          options={[
            { value: "", label: "Not set" },
            ...EMOTIONAL_STATES.map((s) => ({ value: s, label: s })),
          ]}
          ariaLabel="Emotion"
          triggerClassName="h-9 text-[12px]"
        />
      </SignalField>

      <div className="grid grid-cols-3 gap-3">
        <SignalField label="Initial risk" htmlFor="trade-risk">
          <SignalInput
            id="trade-risk"
            type="number"
            min="0"
            step="0.01"
            value={form.initial_risk}
            onChange={(e) => setForm((f) => ({ ...f, initial_risk: e.target.value }))}
            placeholder="0.00"
          />
        </SignalField>
        <SignalField label="Target" htmlFor="trade-target">
          <SignalInput
            id="trade-target"
            type="number"
            min="0"
            step="0.01"
            value={form.target_price}
            onChange={(e) => setForm((f) => ({ ...f, target_price: e.target.value }))}
            placeholder="Target"
          />
        </SignalField>
        <SignalField label="Stop" htmlFor="trade-stop">
          <SignalInput
            id="trade-stop"
            type="number"
            min="0"
            step="0.01"
            value={form.stop_price}
            onChange={(e) => setForm((f) => ({ ...f, stop_price: e.target.value }))}
            placeholder="Stop"
          />
        </SignalField>
      </div>

      {customTags.length > 0 && (
        <SignalField label="Tags">
          <TagChipGroup
            tags={customTags}
            selected={form.tag_ids}
            onToggle={toggleTag}
            tone="accent"
          />
        </SignalField>
      )}

      {mistakeTags.length > 0 && (
        <SignalField label="Mistake type">
          <TagChipGroup
            tags={mistakeTags}
            selected={form.tag_ids}
            onToggle={toggleTag}
            tone="neg"
          />
        </SignalField>
      )}

      <RatingField
        label="Setup rating"
        hint="Rate the setup itself — ignore PnL and emotion."
        value={form.confidence}
        onChange={(confidence) => setForm((f) => ({ ...f, confidence }))}
      />
      <RatingField
        label="Execution rating"
        hint="Rate your execution — patience, timing, stop discipline."
        value={form.trade_quality}
        onChange={(trade_quality) => setForm((f) => ({ ...f, trade_quality }))}
      />

      <SignalField label="Entry reason" htmlFor="trade-entry-reason">
        <SignalTextarea
          id="trade-entry-reason"
          value={form.entry_reason}
          onChange={(e) => setForm((f) => ({ ...f, entry_reason: e.target.value }))}
          rows={2}
          placeholder="Why did you enter?"
        />
      </SignalField>

      <SignalField label="Exit reason" htmlFor="trade-exit-reason">
        <SignalTextarea
          id="trade-exit-reason"
          value={form.exit_reason}
          onChange={(e) => setForm((f) => ({ ...f, exit_reason: e.target.value }))}
          rows={2}
          placeholder="Why did you exit?"
        />
      </SignalField>

      <SignalField label="Review notes" htmlFor="trade-review-notes">
        <SignalTextarea
          id="trade-review-notes"
          value={form.review_notes}
          onChange={(e) => setForm((f) => ({ ...f, review_notes: e.target.value }))}
          rows={3}
          placeholder="What would you do differently?"
        />
      </SignalField>

      <div className="grid grid-cols-2 gap-3">
        <SignalField label="MAE ($)" htmlFor="trade-mae">
          <SignalInput
            id="trade-mae"
            type="number"
            step="0.01"
            value={form.mae}
            onChange={(e) => setForm((f) => ({ ...f, mae: e.target.value }))}
            placeholder="Max adverse"
          />
        </SignalField>
        <SignalField label="MFE ($)" htmlFor="trade-mfe">
          <SignalInput
            id="trade-mfe"
            type="number"
            step="0.01"
            value={form.mfe}
            onChange={(e) => setForm((f) => ({ ...f, mfe: e.target.value }))}
            placeholder="Max favorable"
          />
        </SignalField>
      </div>

      <button
        type="button"
        onClick={() => onSave(withBuiltNotes(form))}
        disabled={saving}
        className={cn(primaryButtonClass, "h-9 w-full")}
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screenshots panel
// ---------------------------------------------------------------------------

interface ScreenshotsPanelProps {
  attachments: TradeAttachment[];
  loading: boolean;
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: (attachmentId: string) => void;
}

function ScreenshotsPanel({
  attachments,
  loading,
  uploading,
  onUpload,
  onDelete,
}: ScreenshotsPanelProps) {
  if (loading) {
    return <Skeleton height="120px" />;
  }

  return (
    <JournalScreenshotUpload
      items={attachments.map((att) => ({
        key: att.id,
        name: att.filename,
        sizeBytes: att.size_bytes,
        attachmentId: att.id,
        preview: <AuthedImage attachmentId={att.id} filename={att.filename} />,
        state: uploading ? "uploading" : "done",
        onRemove: () => onDelete(att.id),
      }))}
      onAddFiles={(files) => {
        for (const file of files) onUpload(file);
      }}
      uploading={uploading}
      addLabel="Upload screenshot"
      addDescription="PNG, JPG · one or more images"
      inputTestId="trade-screenshot-input"
    />
  );
}

// ---------------------------------------------------------------------------
// TradeDetailView
// ---------------------------------------------------------------------------

export interface TradeDetailViewProps {
  trade: TradeDetail | undefined;
  loading: boolean;
  error: boolean;
  setups: Setup[];
  allTags: Tag[];
  attachments: TradeAttachment[];
  attachmentsLoading: boolean;
  saving: boolean;
  uploading: boolean;
  addingFill?: boolean;
  mutatingFill?: boolean;
  onSave: (state: JournalFormState) => void;
  onUpload: (file: File) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  onAddFill?: (input: AddFillInput) => void;
  onEditFill?: (fillId: string, input: AddFillInput) => void;
  onDeleteFill?: (fillId: string) => void;
  onBack?: () => void;
}

export function TradeDetailView({
  trade,
  loading,
  error,
  setups,
  allTags,
  attachments,
  attachmentsLoading,
  saving,
  uploading,
  addingFill = false,
  mutatingFill = false,
  onSave,
  onUpload,
  onDeleteAttachment,
  onAddFill,
  onEditFill,
  onDeleteFill,
  onBack,
}: TradeDetailViewProps) {
  if (loading) {
    return (
      <Page fill>
        <Card>
          <Skeleton height="96px" />
        </Card>
        <Card>
          <Skeleton height="280px" />
        </Card>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
          <Card>
            <Skeleton height="320px" />
          </Card>
          <Card>
            <Skeleton height="320px" />
          </Card>
        </div>
      </Page>
    );
  }

  if (error || !trade) {
    return (
      <Page fill className="items-center justify-center">
        <EmptyState
          title="Trade not found"
          hint="This trade may have been deleted or the ID is invalid."
        />
      </Page>
    );
  }

  const customTags = allTags.filter((t) => t.kind === "custom");
  const mistakeTags = allTags.filter((t) => t.kind === "mistake");

  const initialSetupIds =
    trade.setup_ids && trade.setup_ids.length > 0
      ? trade.setup_ids
      : trade.setup?.id
        ? [trade.setup.id]
        : [];
  const journalInitial: JournalFormState = hydrateJournalForm({
    notes: trade.notes ?? "",
    session: "",
    entry_reason: "",
    exit_reason: "",
    review_notes: "",
    setup_id: initialSetupIds[0] ?? "",
    setup_ids: initialSetupIds,
    initial_risk: trade.initial_risk != null ? String(trade.initial_risk) : "",
    target_price: trade.target_price != null ? String(trade.target_price) : "",
    stop_price: trade.stop_price != null ? String(trade.stop_price) : "",
    emotional_state: trade.emotional_state ?? "",
    confidence: trade.confidence != null ? String(trade.confidence) : "",
    trade_quality: trade.trade_quality != null ? String(trade.trade_quality) : "",
    mae: trade.mae != null ? String(trade.mae) : "",
    mfe: trade.mfe != null ? String(trade.mfe) : "",
    tag_ids: (trade.tags ?? []).map((t) => t.id),
  });

  const riskReward = computeRiskReward(trade);
  const hasRiskReward =
    riskReward.target != null ||
    riskReward.stop != null ||
    riskReward.maxProfit != null ||
    riskReward.maxLoss != null ||
    riskReward.breakeven != null ||
    riskReward.plannedRR != null ||
    trade.r_multiple != null;

  return (
    <Page fill>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 self-start text-xs text-text-muted transition-colors hover:text-text"
        >
          <ArrowLeft size={13} strokeWidth={1.5} />
          Back to trades
        </button>
      )}

      <TradeHeader trade={trade} />

      <Card flush className="pt-4">
        <TradeChartSection trade={trade} />
      </Card>

      {hasRiskReward && (
        <Card>
          <RiskRewardPanel trade={trade} metrics={riskReward} className="p-0" />
        </Card>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title={`Fills (${trade.fills.length})`} flush>
            <FillsTable
              fills={trade.fills}
              currency={trade.pnl_currency}
              mutating={mutatingFill || addingFill}
              onEditFill={
                onEditFill
                  ? (fill, input) => {
                      onEditFill(fill.id, input);
                    }
                  : undefined
              }
              onDeleteFill={
                onDeleteFill
                  ? (fill) => {
                      onDeleteFill(fill.id);
                    }
                  : undefined
              }
            />
            {onAddFill && (
              <AddFillForm
                defaultSide={trade.direction === "short" ? "buy" : "sell"}
                busy={addingFill}
                onSubmit={onAddFill}
              />
            )}
          </Card>

          <Card title="Screenshots">
            <ScreenshotsPanel
              attachments={attachments}
              loading={attachmentsLoading}
              uploading={uploading}
              onUpload={onUpload}
              onDelete={onDeleteAttachment}
            />
          </Card>
        </div>

        <Card title="Journal">
          <JournalPanel
            key={trade.id}
            tradeId={trade.id}
            initialState={journalInitial}
            setups={setups}
            customTags={customTags}
            mistakeTags={mistakeTags}
            saving={saving}
            onSave={onSave}
          />
        </Card>
      </div>
    </Page>
  );
}
