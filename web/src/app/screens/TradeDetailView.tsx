import { ArrowLeft, Loader2, MoreVertical, Pencil, RefreshCw, Share2, Trash2 } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Card } from "@/components/Card";
import { TradeChartSection } from "@/components/charts/TradeChartSection";
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/Collapsible";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { Page } from "@/components/Page";
import { Pill } from "@/components/Pill";
import { AmountInput } from "@/components/AmountInput";
import { Field } from "@/components/Field";
import { FormInput, FormTextarea } from "@/components/FormInput";
import { OptionsSelect } from "@/components/OptionsSelect";
import { ToneToggle } from "@/components/ToneToggle";
import { fieldLabelClass } from "@/components/field-styles";
import { Skeleton } from "@/components/Skeleton";
import { GradeControl } from "@/components/GradeControl";
import { TradeExecutionsCard } from "@/components/TradeExecutionsCard";
import { TradeJournalCard } from "@/components/TradeJournalCard";
import { TradePlanCard } from "@/components/TradePlanCard";
import { TradeSummaryCard } from "@/components/TradeSummaryCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import type { Setup, Tag, TradeDetail } from "@/lib/api/types";
import { fmtDateTime, fmtMoney } from "@/lib/format";

import {
  buildStructuredJournalNotes,
  EMOTIONAL_STATES,
  parseJournalNotes,
} from "@/lib/newTradeJournal";
import { intlLocale } from "@/lib/locale";
import {
  computeTradeInsights,
  generateTradeCoachNotes,
  type CoachTone,
  type TradeCoachNote,
  type TradeInsights,
} from "@/lib/tradeInsights";
import { useToastManager } from "@/components/Toast";
import { TradeShareModal } from "@/components/TradeShareCard";
import { useComputeExcursion } from "@/lib/hooks/useTradeDetail";
import { useTradeCoach } from "@/lib/hooks/useTradeCoach";
import {
  useAttachments,
  useDeleteAttachment,
  useUploadAttachment,
} from "@/lib/hooks/useAttachments";
import { useJournalPrefs } from "@/lib/journalPrefs";
import { gradeFromInt, intFromGrade, TRADE_SESSIONS, type TradeGrade } from "@/lib/tradeGrades";
import {
  JournalScreenshotUpload,
  type ScreenshotAttachmentItem,
} from "@/components/JournalScreenshotUpload";

// ---------------------------------------------------------------------------
// Coach
// ---------------------------------------------------------------------------

function coachToneClass(tone: CoachTone): string {
  switch (tone) {
    case "neg":
      return "text-destructive";
    case "warn":
      // `warning` is the semantic alert token; `chart-3` is data-viz paint.
      return "text-warning";
    case "pos":
      return "text-profit";
    default:
      return "text-primary";
  }
}

function coachToneLabel(tone: CoachTone): string {
  switch (tone) {
    case "neg":
      return "Issue";
    case "warn":
      return "Watch";
    case "pos":
      return "Strength";
    default:
      return "Tip";
  }
}

function TradeCoachNotes({ notes }: { notes: TradeCoachNote[] }) {
  if (notes.length === 0) return null;

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {notes.map((note) => (
        <li key={note.id} className="rounded-lg bg-sidebar px-3 py-2.5">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <span className={coachToneClass(note.tone)}>{coachToneLabel(note.tone)}</span>
            <span className="text-muted-foreground"> · </span>
            {note.headline}
          </p>
          <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {note.detail}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * The single step the model was required to commit to. Rendered apart from the
 * notes because it is the one line meant to change the next trade — the notes
 * explain, this concludes.
 */
function TradeCoachNextAction({ action }: { action: string }) {
  return (
    <div className="rounded-lg bg-primary/10 px-3 py-2.5">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-widest text-primary">
        Next action
      </p>
      <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-foreground">{action}</p>
    </div>
  );
}

function toCoachNotes(
  notes: { id: string; tone: string; headline: string; detail: string; priority: number }[],
): TradeCoachNote[] {
  return notes.map((n) => ({
    id: n.id,
    tone: (["neg", "warn", "pos", "tip"].includes(n.tone) ? n.tone : "tip") as CoachTone,
    headline: n.headline,
    detail: n.detail,
    priority: n.priority,
  }));
}

function TradeCoachPanel({ trade, insights }: { trade: TradeDetail; insights: TradeInsights }) {
  const [open, setOpen] = useState(true);
  const ruleNotes = generateTradeCoachNotes(trade, insights);
  const coach = useTradeCoach(trade.id);
  const { reset: resetCoach } = coach;

  useEffect(() => {
    resetCoach();
  }, [trade.id, resetCoach]);

  const llmNotes =
    coach.data?.source === "llm" && coach.data.notes.length > 0
      ? toCoachNotes(coach.data.notes)
      : null;
  const hasGenerated = coach.data != null || coach.isError;
  const coachNotes = llmNotes ?? ruleNotes;
  const usingLlm = llmNotes != null;
  const showAskAi = coach.coachConfigured;
  // Only ever shown alongside the model's own notes — pairing it with the
  // rule-based fallback would attribute the action to advice that never ran.
  const nextAction = usingLlm ? coach.data?.next_action?.trim() : undefined;
  // A review read back from storage is dated, so it does not read as advice
  // just written about the trade you are looking at now.
  const savedLabel =
    coach.fromStorage && coach.data?.created_at
      ? `Saved review from ${fmtDateTime(coach.data.created_at)}`
      : undefined;
  // Notes stream in one at a time; showing them as they land is the whole
  // point of the streaming endpoint, so they replace the skeleton.
  const streamingNotes =
    coach.isPending && coach.streamingNotes.length > 0 ? toCoachNotes(coach.streamingNotes) : null;

  // Excursion moved to the plan card — this panel is advice, not measurement,
  // so with no notes there is nothing left to show.
  if (coachNotes.length === 0 && !coach.isPending) return null;

  const collapsedSummary = coachNotes[0]?.headline;
  const errorMsg =
    coach.data?.source === "error"
      ? coach.data.error
      : coach.isError
        ? "Could not reach the coach API"
        : undefined;

  return (
    <section className="flex flex-col rounded-lg bg-card">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className="w-full items-center justify-between gap-4 px-4 py-3"
          aria-label="Coach"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            {/* Same type as a Card title — Coach is a card block that happens to
                collapse, not a differently-branded panel. */}
            <h2 className="shrink-0 text-xs font-medium text-muted-foreground">Coach</h2>
            {hasGenerated ? (
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                  usingLlm ? "bg-primary/10 text-primary" : "bg-sidebar text-muted-foreground",
                )}
              >
                {usingLlm ? "AI" : "Rules"}
              </span>
            ) : null}
            {!open && collapsedSummary ? (
              <span className="truncate text-[10px] text-muted-foreground">{collapsedSummary}</span>
            ) : null}
          </div>
          <CollapsibleChevron />
        </CollapsibleTrigger>
        <CollapsibleContent animation="height">
          <div className="flex flex-col gap-4 px-4 pb-4">
            {showAskAi ? (
              <div className="flex items-center justify-between gap-2">
                <p className="m-0 min-w-0 flex-1 text-[11px] text-muted-foreground">
                  {coach.isPending
                    ? "Asking the coach…"
                    : usingLlm
                      ? (savedLabel ?? "Generated from this trade via your coach model")
                      : errorMsg
                        ? "Showing rule-based notes — AI unavailable"
                        : hasGenerated
                          ? "Rule-based notes — AI coach returned nothing useful"
                          : "Rule-based notes — click Ask AI for model coaching"}
                </p>
                <Button
                  type="button"
                  variant={hasGenerated ? "ghost" : "soft"}
                  size="sm"
                  aria-label={hasGenerated ? "Regenerate AI coach" : "Ask AI coach"}
                  disabled={coach.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void coach.generate();
                  }}
                >
                  {coach.isPending ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : hasGenerated ? (
                    <RefreshCw aria-hidden />
                  ) : null}
                  {coach.isPending ? "Generating…" : hasGenerated ? "Regenerate" : "Ask AI"}
                </Button>
              </div>
            ) : null}

            {streamingNotes ? (
              // Notes that have landed so far, with one skeleton standing in
              // for the note still being written.
              <div className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
                <TradeCoachNotes notes={streamingNotes} />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : coach.isPending && !hasGenerated ? (
              <div className="flex flex-col gap-2" aria-busy="true">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : (
              <>
                <TradeCoachNotes notes={coachNotes} />
                {nextAction ? <TradeCoachNextAction action={nextAction} /> : null}
              </>
            )}

            {errorMsg && !usingLlm ? (
              <p className="m-0 text-[11px] text-muted-foreground" role="status">
                {errorMsg}
              </p>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
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
          <ToneToggle
            key={tag.id}
            pressed={active}
            tone={tone}
            // Custom tags carry their own hue; mistakes keep the loss tone.
            color={tone === "neg" ? undefined : tag.color || undefined}
            onPressedChange={() => onToggle(tag.id)}
            aria-label={tag.name}
          >
            {tag.name}
          </ToneToggle>
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
  currency: string;
  saving: boolean;
  onSave: (state: JournalFormState) => void;
  /** Rendered above the optional Save button (e.g. screenshots). */
  children?: ReactNode;
  /** Hide inline Save — parent footer triggers save via ref. */
  hideSave?: boolean;
  /** View-only — no inputs or toggles. */
  readOnly?: boolean;
}

export type JournalPanelHandle = {
  save: () => void;
  reset: () => void;
};

function JournalReadOnlyField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className={fieldLabelClass}>{label}</p>
      <div className="text-[13px] leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

function JournalReadOnlyView({
  form,
  setups,
  customTags,
  mistakeTags,
  currency,
  children,
}: {
  form: JournalFormState;
  setups: Setup[];
  customTags: Tag[];
  mistakeTags: Tag[];
  currency: string;
  children?: ReactNode;
}) {
  const hydrated = hydrateJournalForm(form);
  const setupGrade = gradeFromInt(
    hydrated.confidence ? Number.parseInt(hydrated.confidence, 10) : null,
  );
  const execGrade = gradeFromInt(
    hydrated.trade_quality ? Number.parseInt(hydrated.trade_quality, 10) : null,
  );
  const selectedSetups = setups.filter((s) => hydrated.setup_ids.includes(s.id));
  const selectedCustom = customTags.filter((t) => hydrated.tag_ids.includes(t.id));
  const selectedMistake = mistakeTags.filter((t) => hydrated.tag_ids.includes(t.id));
  const dash = <span className="text-muted-foreground">—</span>;

  const moneyField = (raw: string) => {
    const n = Number.parseFloat(raw);
    if (!raw.trim() || Number.isNaN(n)) return dash;
    return fmtMoney(n, currency, intlLocale());
  };

  const textBlock = (value: string) =>
    value.trim() ? <p className="m-0 whitespace-pre-wrap">{value}</p> : dash;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className={fieldLabelClass}>Setups</p>
        {selectedSetups.length === 0 ? (
          dash
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selectedSetups.map((s, idx) => (
              <Pill key={s.id} tone="accent">
                {idx === 0 ? `${s.name} · main` : s.name}
              </Pill>
            ))}
          </div>
        )}
      </div>

      <JournalReadOnlyField label="Session">
        {hydrated.session.trim() ? hydrated.session : dash}
      </JournalReadOnlyField>

      <JournalReadOnlyField label="Emotion">
        {hydrated.emotional_state.trim() ? hydrated.emotional_state : dash}
      </JournalReadOnlyField>

      <div className="grid grid-cols-3 gap-3">
        <JournalReadOnlyField label="Initial risk">
          {moneyField(hydrated.initial_risk)}
        </JournalReadOnlyField>
        <JournalReadOnlyField label="Target">
          {moneyField(hydrated.target_price)}
        </JournalReadOnlyField>
        <JournalReadOnlyField label="Stop">{moneyField(hydrated.stop_price)}</JournalReadOnlyField>
      </div>

      {selectedCustom.length > 0 && (
        <div>
          <p className={fieldLabelClass}>Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedCustom.map((t) => (
              <Pill key={t.id} tone="muted">
                {t.name}
              </Pill>
            ))}
          </div>
        </div>
      )}

      {selectedMistake.length > 0 && (
        <div>
          <p className={fieldLabelClass}>Mistake type</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedMistake.map((t) => (
              <Pill key={t.id} tone="neg">
                {t.name}
              </Pill>
            ))}
          </div>
        </div>
      )}

      {(setupGrade || execGrade) && (
        <div className="flex flex-wrap gap-3">
          {setupGrade ? (
            <JournalReadOnlyField label="Setup rating">
              <Pill tone="accent">{setupGrade}</Pill>
            </JournalReadOnlyField>
          ) : null}
          {execGrade ? (
            <JournalReadOnlyField label="Execution rating">
              <Pill tone="accent">{execGrade}</Pill>
            </JournalReadOnlyField>
          ) : null}
        </div>
      )}

      <JournalReadOnlyField label="Entry reason">
        {textBlock(hydrated.entry_reason)}
      </JournalReadOnlyField>
      <JournalReadOnlyField label="Exit reason">
        {textBlock(hydrated.exit_reason)}
      </JournalReadOnlyField>
      <JournalReadOnlyField label="Review notes">
        {textBlock(hydrated.review_notes)}
      </JournalReadOnlyField>

      <div className="grid grid-cols-2 gap-3">
        <JournalReadOnlyField label="MAE ($)">{moneyField(hydrated.mae)}</JournalReadOnlyField>
        <JournalReadOnlyField label="MFE ($)">{moneyField(hydrated.mfe)}</JournalReadOnlyField>
      </div>

      {children}
    </div>
  );
}

export const JournalPanel = forwardRef<JournalPanelHandle, JournalPanelProps>(function JournalPanel(
  {
    tradeId,
    initialState,
    setups,
    customTags,
    mistakeTags,
    currency,
    saving,
    onSave,
    children,
    hideSave = false,
    readOnly = false,
  },
  ref,
) {
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

  useImperativeHandle(
    ref,
    () => ({
      save: () => onSave(withBuiltNotes(form)),
      reset: () => {
        const next = hydrateJournalForm(initialState);
        setForm(next);
        setDraftRestored(false);
        prevInitial.current = next;
        try {
          localStorage.removeItem(journalDraftKey(tradeId));
        } catch {
          /* ignore */
        }
      },
    }),
    [form, onSave, initialState, tradeId],
  );

  if (readOnly) {
    return (
      <JournalReadOnlyView
        form={seeded}
        setups={setups}
        customTags={customTags}
        mistakeTags={mistakeTags}
        currency={currency}
      >
        {children}
      </JournalReadOnlyView>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {draftRestored && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-accent px-3 py-2">
          <span className="text-[11px] text-muted-foreground">Unsaved draft restored.</span>
          <Button
            type="button"
            variant="link"
            onClick={discardDraft}
            className="h-auto text-[11px]"
          >
            Discard draft
          </Button>
        </div>
      )}

      <div>
        <p className={fieldLabelClass}>Setups (select multiple)</p>
        <p className="mb-2 text-[10px] text-muted-foreground">
          First selected setup becomes the main setup.
        </p>
        {setups.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No setups yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {setups.map((s) => {
              const idx = form.setup_ids.indexOf(s.id);
              const on = idx >= 0;
              return (
                <ToneToggle key={s.id} pressed={on} onPressedChange={() => toggleSetup(s.id)}>
                  {on && idx === 0 ? `${s.name} · main` : s.name}
                </ToneToggle>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className={fieldLabelClass}>Session</p>
        <div className="flex flex-wrap gap-1.5">
          {TRADE_SESSIONS.map((s) => {
            const on = form.session === s;
            return (
              <ToneToggle
                key={s}
                pressed={on}
                onPressedChange={() => setForm((f) => ({ ...f, session: on ? "" : s }))}
                aria-label={`Session ${s}`}
              >
                {s}
              </ToneToggle>
            );
          })}
        </div>
      </div>

      <Field label="Emotion" htmlFor="trade-emotion">
        <OptionsSelect
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
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Initial risk" htmlFor="trade-risk">
          <AmountInput
            id="trade-risk"
            value={form.initial_risk}
            onValueChange={(initial_risk) => setForm((f) => ({ ...f, initial_risk }))}
            placeholder="0.00"
          />
        </Field>
        <Field label="Target" htmlFor="trade-target">
          <AmountInput
            id="trade-target"
            value={form.target_price}
            onValueChange={(target_price) => setForm((f) => ({ ...f, target_price }))}
            placeholder="Target"
          />
        </Field>
        <Field label="Stop" htmlFor="trade-stop">
          <AmountInput
            id="trade-stop"
            value={form.stop_price}
            onValueChange={(stop_price) => setForm((f) => ({ ...f, stop_price }))}
            placeholder="Stop"
          />
        </Field>
      </div>

      {customTags.length > 0 && (
        <Field label="Tags">
          <TagChipGroup
            tags={customTags}
            selected={form.tag_ids}
            onToggle={toggleTag}
            tone="accent"
          />
        </Field>
      )}

      {mistakeTags.length > 0 && (
        <Field label="Mistake type">
          <TagChipGroup
            tags={mistakeTags}
            selected={form.tag_ids}
            onToggle={toggleTag}
            tone="neg"
          />
        </Field>
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

      <Field label="Entry reason" htmlFor="trade-entry-reason">
        <FormTextarea
          id="trade-entry-reason"
          value={form.entry_reason}
          onChange={(e) => setForm((f) => ({ ...f, entry_reason: e.target.value }))}
          rows={2}
          placeholder="Why did you enter?"
        />
      </Field>

      <Field label="Exit reason" htmlFor="trade-exit-reason">
        <FormTextarea
          id="trade-exit-reason"
          value={form.exit_reason}
          onChange={(e) => setForm((f) => ({ ...f, exit_reason: e.target.value }))}
          rows={2}
          placeholder="Why did you exit?"
        />
      </Field>

      <Field label="Review notes" htmlFor="trade-review-notes">
        <FormTextarea
          id="trade-review-notes"
          value={form.review_notes}
          onChange={(e) => setForm((f) => ({ ...f, review_notes: e.target.value }))}
          rows={3}
          placeholder="What would you do differently?"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="MAE ($)" htmlFor="trade-mae">
          <AmountInput
            id="trade-mae"
            value={form.mae}
            onValueChange={(mae) => setForm((f) => ({ ...f, mae }))}
            placeholder="Max adverse"
            allowNegative
          />
        </Field>
        <Field label="MFE ($)" htmlFor="trade-mfe">
          <AmountInput
            id="trade-mfe"
            value={form.mfe}
            onValueChange={(mfe) => setForm((f) => ({ ...f, mfe }))}
            placeholder="Max favorable"
            allowNegative
          />
        </Field>
      </div>

      {children}

      {!hideSave && (
        <Button
          type="button"
          variant="soft"
          onClick={() => onSave(withBuiltNotes(form))}
          disabled={saving}
          className="h-9 w-full"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// TradeDetailView
// ---------------------------------------------------------------------------

export interface TradeDetailViewProps {
  trade: TradeDetail | undefined;
  loading: boolean;
  error: boolean;
  onBack?: () => void;
  onEdit?: () => void;
  onDelete?: () => void | Promise<void>;
  deleting?: boolean;
}

export function TradeDetailView({
  trade,
  loading,
  error,
  onBack,
  onEdit,
  onDelete,
  deleting = false,
}: TradeDetailViewProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [typedConfirm, setTypedConfirm] = useState("");
  const confirmInputId = useId();
  const computeExcursion = useComputeExcursion();
  const toast = useToastManager();

  // Placeholder heights mirror the real cards — summary, plan, chart — so the
  // page does not jump when the trade lands.
  if (loading) {
    return (
      <Page fill>
        <Card>
          <Skeleton height="132px" />
        </Card>
        <Card>
          <Skeleton height="180px" />
        </Card>
        <Card>
          <Skeleton height="320px" />
        </Card>
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

  const insights = computeTradeInsights(trade);
  const canDelete = typedConfirm.trim().toUpperCase() === trade.symbol.trim().toUpperCase();

  // Options chart their underlying, so bar-derived excursion would mislead.
  const canAutoExcursion = trade.status === "closed" && trade.instrument_type !== "option";
  const onAutoExcursion = () => {
    computeExcursion.mutate(trade.id, {
      onSuccess: (res) => {
        const bars = res.interval === "D" ? "daily" : `${res.interval}-minute`;
        toast.add({
          title: "Excursion updated",
          description: `MAE/MFE computed from ${res.bars_used} ${bars} bars.`,
        });
      },
      onError: (err) => {
        toast.add({
          title: "Could not compute MAE/MFE",
          description: err instanceof Error ? err.message : "Market data unavailable.",
        });
      },
    });
  };

  const closeDeleteModal = (open: boolean) => {
    setDeleteOpen(open);
    if (!open) setTypedConfirm("");
  };

  return (
    <Page fill>
      <div className="flex items-center justify-between gap-3">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="h-auto gap-1 self-start px-0 text-xs hover:bg-transparent"
          >
            <ArrowLeft size={13} strokeWidth={1.5} />
            Back to trades
          </Button>
        ) : (
          <span />
        )}
        {/* Edit is the action a review reaches for; delete is rare and
            irreversible, so it moves into the overflow menu instead of sitting
            on the page as the loudest element on it. */}
        <div className="flex shrink-0 items-center gap-1.5">
          {onEdit && (
            <Button
              type="button"
              variant="soft"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={onEdit}
              disabled={deleting}
            >
              <Pencil size={14} strokeWidth={1.5} aria-hidden />
              Edit trade
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Trade actions"
              disabled={deleting}
              className={cn(
                "flex size-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent",
                "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <MoreVertical size={15} strokeWidth={1.5} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" sideOffset={4} className="p-1">
              <DropdownMenuItem onClick={() => setShareOpen(true)}>
                <Share2 size={14} strokeWidth={1.5} aria-hidden />
                Share card
              </DropdownMenuItem>
              {onDelete ? (
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 size={14} strokeWidth={1.5} aria-hidden />
                  Remove trade
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {onDelete ? (
        <Modal
          open={deleteOpen}
          onOpenChange={closeDeleteModal}
          title={`Remove ${trade.symbol}?`}
          className="max-w-[min(336px,94vw)]"
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={deleting}
                onClick={() => closeDeleteModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!canDelete || deleting}
                onClick={() => {
                  void Promise.resolve(onDelete()).finally(() => closeDeleteModal(false));
                }}
                className="border-transparent bg-destructive/15 hover:bg-destructive/25"
              >
                {deleting ? "Removing…" : "Remove trade"}
              </Button>
            </>
          }
        >
          <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
            Permanently deletes this trade and all of its fills. This cannot be undone.
          </p>
          <div>
            <label
              htmlFor={confirmInputId}
              className="mb-1.5 block text-[11px] text-muted-foreground"
            >
              Type <span className="font-medium text-foreground">{trade.symbol}</span> to confirm
            </label>
            <FormInput
              id={confirmInputId}
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-label={`Type ${trade.symbol} to confirm`}
            />
          </div>
        </Modal>
      ) : null}

      <TradeShareModal
        trade={trade}
        insights={insights}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />

      {/* Ordered by the questions a review actually asks: what happened, did it
          follow the plan, what did price do, why did I take it, how was it
          filled, what should change, what did it look like. */}
      <TradeSummaryCard trade={trade} insights={insights} />

      <TradePlanCard
        trade={trade}
        insights={insights}
        onEdit={onEdit}
        onAutoExcursion={canAutoExcursion ? onAutoExcursion : undefined}
        autoExcursionPending={computeExcursion.isPending}
      />

      <Card flush className="pt-4">
        <TradeChartSection trade={trade} />
      </Card>

      <TradeJournalCard trade={trade} onEdit={onEdit} />

      <TradeExecutionsCard trade={trade} />

      <TradeCoachPanel trade={trade} insights={insights} />

      <Card title="Screenshots" description="Charts and fills attached to this trade.">
        <TradeScreenshotsSection tradeId={trade.id} />
      </Card>
    </Page>
  );
}

function TradeScreenshotsSection({ tradeId }: { tradeId: string }) {
  const { data: attachments = [], isLoading } = useAttachments(tradeId);
  const upload = useUploadAttachment(tradeId);
  const remove = useDeleteAttachment(tradeId);
  const maxScreenshots = useJournalPrefs((s) => s.maxScreenshotsPerTrade);
  const uploading = upload.isPending;

  const items: ScreenshotAttachmentItem[] = attachments.map((att) => ({
    key: att.id,
    name: att.filename,
    sizeBytes: att.size_bytes,
    attachmentId: att.id,
    state: "done",
    onRemove: () => {
      void remove.mutateAsync(att.id);
    },
  }));

  async function onAddFiles(files: File[]) {
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      await upload.mutateAsync(fd);
    }
  }

  return isLoading ? (
    <Skeleton height="72px" />
  ) : (
    <JournalScreenshotUpload
      items={items}
      onAddFiles={(files) => void onAddFiles(files)}
      uploading={uploading}
      disabled={remove.isPending}
      maxCount={maxScreenshots}
      addLabel="Add screenshots"
      addDescription="PNG, JPG, WebP · click to browse"
    />
  );
}
