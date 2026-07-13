import { ArrowLeft, Paperclip, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { Pill } from "../../components/Pill";
import { SignalField } from "../../components/SignalField";
import { SignalInput, SignalTextarea } from "../../components/SignalInput";
import { SignalSelect } from "../../components/SignalSelect";
import { Skeleton } from "../../components/Skeleton";
import { heroPnlClass, pnlColor } from "../../components/theme-tokens";
import { cn } from "../../lib/cn";
import { getToken } from "../../lib/api/client";
import type { Execution, Setup, Tag, TradeAttachment, TradeDetail } from "../../lib/api/types";
import { fmtMoney, fmtSignedMoney } from "../../lib/format";
import { EMOTIONAL_STATES } from "../../lib/newTradeJournal";
import { intlLocale } from "../../lib/locale";

const accentButtonClass =
  "inline-flex h-8 cursor-pointer items-center rounded-control border-none bg-accent px-3 text-[12px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55";

const ghostButtonClass =
  "inline-flex h-8 cursor-pointer items-center gap-2 rounded-control border border-border bg-bg-hover px-3 text-xs text-text transition-colors hover:border-border-strong hover:bg-bg-panel disabled:cursor-not-allowed disabled:opacity-55";

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

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-xs">
      <span className="text-label">{label}</span>
      <span className="tabular-nums text-text">{value}</span>
    </span>
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
      <div className="flex aspect-video w-full items-center justify-center rounded-sharp bg-bg-hover text-xs text-text-muted">
        {filename}
      </div>
    );
  }

  if (!src) {
    return <Skeleton height="120px" />;
  }

  return (
    <img src={src} alt={filename} className="max-h-[200px] w-full rounded-sharp object-cover" />
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

interface TradeHeaderProps {
  trade: TradeDetail;
  onBack?: () => void;
}

function TradeHeader({ trade, onBack }: TradeHeaderProps) {
  const currency = trade.pnl_currency;
  const pnl = trade.net_pnl;
  const rMultiple = trade.r_multiple;
  const returnPct = trade.return_pct;

  return (
    <div className="border-b border-border bg-bg px-4 py-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
        >
          <ArrowLeft size={13} strokeWidth={1.5} />
          Back to trades
        </button>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[28px] font-semibold tracking-[-0.03em] text-text">
            {trade.symbol}
          </span>
          <Pill tone={trade.direction === "long" ? "pos" : "neg"}>{trade.direction}</Pill>
          <span className="text-xs uppercase tracking-wide text-text-muted">
            {trade.instrument_type}
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-3">
          {pnl != null && (
            <span
              className={cn(heroPnlClass(pnl), "text-[28px]!")}
              title="Price P&L (excludes dividends)"
            >
              {fmtSignedMoney(pnl, currency, intlLocale())}
            </span>
          )}
          {trade.dividend_total != null && trade.dividend_total !== 0 && (
            <span
              className="text-sm tabular-nums text-text-muted"
              title="Dividends linked to this trade"
            >
              Div {fmtSignedMoney(trade.dividend_total, currency, intlLocale())}
            </span>
          )}
          {trade.total_pnl != null &&
            trade.dividend_total != null &&
            trade.dividend_total !== 0 && (
              <span
                className={cn("text-sm tabular-nums", pnlColor(trade.total_pnl))}
                title="Total = price P&L + dividends"
              >
                Total {fmtSignedMoney(trade.total_pnl, currency, intlLocale())}
              </span>
            )}
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
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <MetaStat label="Opened" value={fmtDate(trade.opened_at)} />
        <MetaStat label="Closed" value={fmtDate(trade.closed_at)} />
        <MetaStat label="Qty" value={String(trade.qty_opened)} />
        <MetaStat label="Entry" value={fmtMoney(trade.avg_entry_price, currency, intlLocale())} />
        {trade.avg_exit_price != null && (
          <MetaStat label="Exit" value={fmtMoney(trade.avg_exit_price, currency, intlLocale())} />
        )}
        <MetaStat label="Fees" value={fmtMoney(trade.fees_total, currency, intlLocale())} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fills table
// ---------------------------------------------------------------------------

interface FillsTableProps {
  fills: Execution[];
  currency: string;
}

function FillsTable({ fills, currency }: FillsTableProps) {
  if (fills.length === 0) {
    return <EmptyState title="No fills" hint="Executions will appear here once imported." />;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-border bg-bg">
            {["Side", "Qty", "Price", "Fees", "Executed"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-label font-medium whitespace-nowrap">
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
                  "border-b border-border px-3 py-2 font-medium uppercase",
                  fill.side === "buy" ? "text-profit" : "text-loss",
                )}
              >
                {fill.side.toUpperCase()}
              </td>
              <td className="border-b border-border px-3 py-2 tabular-nums text-text">
                {fill.quantity}
              </td>
              <td className="border-b border-border px-3 py-2 tabular-nums text-text">
                {fmtMoney(fill.price, currency, intlLocale())}
              </td>
              <td className="border-b border-border px-3 py-2 tabular-nums text-text-muted">
                {fmtMoney(fill.fees + fill.commission, currency, intlLocale())}
              </td>
              <td className="border-b border-border px-3 py-2 tabular-nums whitespace-nowrap text-text-muted">
                {fmtDateTime(fill.executed_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface AddFillInput {
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  executed_at: string;
}

function toLocalInputValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const [side, setSide] = useState<"buy" | "sell">(defaultSide);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("0");
  const [at, setAt] = useState(toLocalInputValue);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const quantity = Number.parseFloat(qty);
    const px = Number.parseFloat(price);
    const fee = Number.parseFloat(fees) || 0;
    if (!(quantity > 0) || !(px >= 0)) return;
    onSubmit({
      side,
      quantity,
      price: px,
      fees: fee,
      executed_at: new Date(at).toISOString(),
    });
    setQty("");
    setPrice("");
    setFees("0");
  }

  return (
    <form onSubmit={submit} className="border-t border-border px-4 py-3">
      <p className="mb-2 text-label font-semibold text-text-muted">Add fill</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SignalSelect
          value={side}
          onValueChange={(v) => setSide(v as "buy" | "sell")}
          options={[
            { value: "buy", label: "BUY" },
            { value: "sell", label: "SELL" },
          ]}
          ariaLabel="Fill side"
          triggerClassName="h-8 text-[12px]"
        />
        <SignalInput
          aria-label="Fill qty"
          type="number"
          step="any"
          min="0"
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          required
        />
        <SignalInput
          aria-label="Fill price"
          type="number"
          step="any"
          min="0"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        <SignalInput
          aria-label="Fill fee"
          type="number"
          step="any"
          min="0"
          placeholder="Fee"
          value={fees}
          onChange={(e) => setFees(e.target.value)}
        />
        <SignalInput
          aria-label="Fill datetime"
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
          required
        />
      </div>
      <button type="submit" disabled={busy} className={cn(accentButtonClass, "mt-2")}>
        {busy ? "Adding…" : "Add fill"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Journal panel
// ---------------------------------------------------------------------------

export function journalDraftKey(tradeId: string): string {
  return `tm_draft_trade_${tradeId}`;
}

export interface JournalFormState {
  notes: string;
  setup_id: string;
  initial_risk: string;
  emotional_state: string;
  confidence: string;
  trade_quality: string;
  mae: string;
  mfe: string;
  tag_ids: string[];
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
  const [form, setForm] = useState<JournalFormState>(initialState);

  const prevInitial = useRef(initialState);
  useEffect(() => {
    if (
      prevInitial.current.notes !== initialState.notes ||
      prevInitial.current.setup_id !== initialState.setup_id ||
      prevInitial.current.initial_risk !== initialState.initial_risk ||
      prevInitial.current.emotional_state !== initialState.emotional_state ||
      prevInitial.current.confidence !== initialState.confidence ||
      prevInitial.current.trade_quality !== initialState.trade_quality ||
      prevInitial.current.mae !== initialState.mae ||
      prevInitial.current.mfe !== initialState.mfe ||
      JSON.stringify(prevInitial.current.tag_ids) !== JSON.stringify(initialState.tag_ids)
    ) {
      setForm(initialState);
      prevInitial.current = initialState;
    }
  }, [initialState]);

  const [draftRestored, setDraftRestored] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per trade
  useEffect(() => {
    try {
      const raw = localStorage.getItem(journalDraftKey(tradeId));
      if (!raw) return;
      const draft = JSON.parse(raw) as { at: number; form: JournalFormState };
      if (JSON.stringify(draft.form) !== JSON.stringify(initialState)) {
        setForm(draft.form);
        setDraftRestored(true);
      } else {
        localStorage.removeItem(journalDraftKey(tradeId));
      }
    } catch {
      /* corrupt draft — ignore */
    }
  }, [tradeId]);

  useEffect(() => {
    if (JSON.stringify(form) === JSON.stringify(initialState)) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(journalDraftKey(tradeId), JSON.stringify({ at: Date.now(), form }));
      } catch {
        /* storage full/unavailable — ignore */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [form, initialState, tradeId]);

  function discardDraft() {
    setForm(initialState);
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

  return (
    <div className="flex flex-col gap-4 p-4">
      {draftRestored && (
        <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-bg-inset px-3 py-2">
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

      <SignalField label="Notes" htmlFor="trade-notes">
        <SignalTextarea
          id="trade-notes"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={5}
          placeholder="Write your trade journal entry..."
        />
      </SignalField>

      <SignalField label="Setup" htmlFor="trade-setup">
        <SignalSelect
          id="trade-setup"
          value={form.setup_id}
          onValueChange={(setup_id) => setForm((f) => ({ ...f, setup_id }))}
          options={[
            { value: "", label: "None" },
            ...setups.map((s) => ({ value: s.id, label: s.name })),
          ]}
          ariaLabel="Setup"
          triggerClassName="h-9 text-[12px]"
        />
      </SignalField>

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

      <SignalField label="Emotional state" htmlFor="trade-emotion">
        <SignalSelect
          id="trade-emotion"
          value={form.emotional_state}
          onValueChange={(emotional_state) => setForm((f) => ({ ...f, emotional_state }))}
          options={[
            { value: "", label: "None" },
            ...EMOTIONAL_STATES.map((s) => ({ value: s, label: s })),
          ]}
          ariaLabel="Emotional state"
          triggerClassName="h-9 text-[12px]"
        />
      </SignalField>

      <div className="grid grid-cols-2 gap-3">
        <SignalField label="Confidence" htmlFor="trade-confidence">
          <SignalInput
            id="trade-confidence"
            type="number"
            min="1"
            max="5"
            value={form.confidence}
            onChange={(e) => setForm((f) => ({ ...f, confidence: e.target.value }))}
          />
        </SignalField>
        <SignalField label="Trade quality" htmlFor="trade-quality">
          <SignalInput
            id="trade-quality"
            type="number"
            min="1"
            max="5"
            value={form.trade_quality}
            onChange={(e) => setForm((f) => ({ ...f, trade_quality: e.target.value }))}
          />
        </SignalField>
      </div>

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

      {customTags.length > 0 && (
        <SignalField label="Tags">
          <div className="flex flex-col gap-1.5">
            {customTags.map((tag) => (
              <label key={tag.id} className="flex cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.tag_ids.includes(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                  className="accent-accent"
                />
                <span className="text-xs text-text">{tag.name}</span>
              </label>
            ))}
          </div>
        </SignalField>
      )}

      {mistakeTags.length > 0 && (
        <SignalField label="Mistakes">
          <div className="flex flex-col gap-1.5">
            {mistakeTags.map((tag) => (
              <label key={tag.id} className="flex cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.tag_ids.includes(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                  className="accent-loss"
                />
                <span className="text-xs text-text">{tag.name}</span>
              </label>
            ))}
          </div>
        </SignalField>
      )}

      <button
        type="button"
        onClick={() => onSave(form)}
        disabled={saving}
        className={accentButtonClass}
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      e.target.value = "";
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <Skeleton height="120px" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload screenshot"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={ghostButtonClass}
        >
          <Upload size={13} strokeWidth={1.5} />
          {uploading ? "Uploading..." : "Upload screenshot"}
        </button>
      </div>

      {attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-sharp border border-dashed border-border py-8 text-xs text-text-muted">
          <Paperclip size={20} strokeWidth={1.5} className="opacity-40" />
          No screenshots yet
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {attachments.map((att) => (
            <div key={att.id} className="flex flex-col gap-1">
              <AuthedImage attachmentId={att.id} filename={att.filename} />
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-text-muted">
                  {att.filename}
                  <span className="ml-1 tabular-nums">({fmtBytes(att.size_bytes)})</span>
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(att.id)}
                  title="Delete screenshot"
                  className="shrink-0 cursor-pointer rounded-sharp p-0.5 text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
  onSave: (state: JournalFormState) => void;
  onUpload: (file: File) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  onAddFill?: (input: AddFillInput) => void;
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
  onSave,
  onUpload,
  onDeleteAttachment,
  onAddFill,
  onBack,
}: TradeDetailViewProps) {
  if (loading) {
    return (
      <div className="flex min-h-full flex-col">
        <Panel surface="void" className="flex flex-1 flex-col rounded-none border-0">
          <Skeleton height="112px" />
          <div className="grid grid-cols-1 gap-px bg-border lg:grid-cols-[3fr_2fr]">
            <Skeleton height="320px" className="m-4" />
            <Skeleton height="320px" className="m-4" />
          </div>
        </Panel>
      </div>
    );
  }

  if (error || !trade) {
    return (
      <EmptyState
        title="Trade not found"
        hint="This trade may have been deleted or the ID is invalid."
      />
    );
  }

  const customTags = allTags.filter((t) => t.kind === "custom");
  const mistakeTags = allTags.filter((t) => t.kind === "mistake");

  const journalInitial: JournalFormState = {
    notes: trade.notes ?? "",
    setup_id: trade.setup?.id ?? "",
    initial_risk: trade.initial_risk != null ? String(trade.initial_risk) : "",
    emotional_state: trade.emotional_state ?? "",
    confidence: trade.confidence != null ? String(trade.confidence) : "",
    trade_quality: trade.trade_quality != null ? String(trade.trade_quality) : "",
    mae: trade.mae != null ? String(trade.mae) : "",
    mfe: trade.mfe != null ? String(trade.mfe) : "",
    tag_ids: (trade.tags ?? []).map((t) => t.id),
  };

  return (
    <div className="flex min-h-full flex-col">
      <Panel surface="void" className="flex min-h-full flex-1 flex-col rounded-none border-0">
        <TradeHeader trade={trade} onBack={onBack} />

        <div className="grid min-h-0 flex-1 grid-cols-1 bg-border lg:grid-cols-[3fr_2fr] lg:gap-px">
          {/* Left — fills + screenshots */}
          <div className="flex min-h-0 flex-col divide-y divide-border bg-bg">
            <section className="flex flex-col">
              <div className="border-b border-border px-4 py-2">
                <span className="text-label font-semibold text-text-muted">
                  Fills ({trade.fills.length})
                </span>
              </div>
              <FillsTable fills={trade.fills} currency={trade.pnl_currency} />
              {onAddFill && (
                <AddFillForm
                  defaultSide={trade.direction === "short" ? "buy" : "sell"}
                  busy={addingFill}
                  onSubmit={onAddFill}
                />
              )}
            </section>

            <section className="flex flex-col">
              <div className="border-b border-border px-4 py-2">
                <span className="text-label font-semibold text-text-muted">Screenshots</span>
              </div>
              <ScreenshotsPanel
                attachments={attachments}
                loading={attachmentsLoading}
                uploading={uploading}
                onUpload={onUpload}
                onDelete={onDeleteAttachment}
              />
            </section>
          </div>

          {/* Right — journal */}
          <section className="flex min-h-0 flex-col bg-bg lg:overflow-y-auto">
            <div className="border-b border-border px-4 py-2">
              <span className="text-label font-semibold text-text-muted">Journal</span>
            </div>
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
          </section>
        </div>
      </Panel>
    </div>
  );
}
