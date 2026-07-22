import { ArrowLeft, Loader2, Pencil, RefreshCw, Trash2, Zap } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Card } from "../../components/Card";
import { TradeChartSection } from "../../components/charts/TradeChartSection";
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/Collapsible";
import { EmptyState } from "../../components/EmptyState";
import { Modal } from "../../components/Modal";
import { Page } from "../../components/Page";
import { Pill, type PillTone } from "../../components/Pill";
import { SignalAmountInput } from "../../components/SignalAmountInput";
import { SignalField } from "../../components/SignalField";
import { SignalInput, SignalTextarea } from "../../components/SignalInput";
import { SignalSelect } from "../../components/SignalSelect";
import { SignalToggle } from "../../components/SignalToggle";
import { signalLabelClass } from "../../components/signal-field-styles";
import { Skeleton } from "../../components/Skeleton";
import { GradeControl } from "../../components/GradeControl";
import { marketLabel } from "../../components/tradeColumns";
import { formatOptionMarketChip, optionContractFromFills } from "../../lib/optionContract";
import { Button } from "../../components/ui/button";
import { heroPnlClass, pnlColor } from "../../components/theme-tokens";
import { cn } from "../../lib/cn";
import type { Setup, Tag, TradeDetail } from "../../lib/api/types";
import { fmtDateTime, fmtMoney, fmtSignedMoney, fmtTime } from "../../lib/format";

import {
  buildStructuredJournalNotes,
  EMOTIONAL_STATES,
  parseJournalNotes,
} from "../../lib/newTradeJournal";
import { intlLocale } from "../../lib/locale";
import {
  computeTradeInsights,
  generateTradeCoachNotes,
  type CoachTone,
  type TradeCoachNote,
  type TradeInsights,
} from "../../lib/tradeInsights";
import { useTradeCoach } from "../../lib/hooks/useTradeCoach";
import { gradeFromInt, intFromGrade, TRADE_SESSIONS, type TradeGrade } from "../../lib/tradeGrades";
import { getDisplayTimeOpts, useDisplayTimePrefs, usePrivacyMode } from "../../lib/displayPrefs";

function tradeOutcome(trade: TradeDetail): { label: string; tone: PillTone } {
  if (trade.status !== "closed") return { label: "OPEN", tone: "accent" };
  if (trade.net_pnl == null || trade.net_pnl === 0) return { label: "FLAT", tone: "muted" };
  return trade.net_pnl > 0 ? { label: "WIN", tone: "pos" } : { label: "LOSS", tone: "neg" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calendarDayKey(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Compact open→close line for the header (identity, not a metric dump). */
function fmtTradeTimeline(trade: TradeDetail, hold: string): string {
  const opened = new Date(trade.opened_at);
  if (Number.isNaN(opened.getTime())) return "—";

  const { timeZone } = getDisplayTimeOpts();
  const day = opened.toLocaleDateString(intlLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
  const holdPart = hold && hold !== "-" ? ` · ${hold}` : "";

  if (trade.status === "open" || !trade.closed_at) {
    return `${fmtDateTime(trade.opened_at)} · still open`;
  }

  const closed = new Date(trade.closed_at);
  if (Number.isNaN(closed.getTime())) return `${day}${holdPart}`;

  if (calendarDayKey(opened, timeZone) === calendarDayKey(closed, timeZone)) {
    return `${day} · ${fmtTime(trade.opened_at)} → ${fmtTime(trade.closed_at)}${holdPart}`;
  }

  return `${fmtDateTime(trade.opened_at)} → ${fmtDateTime(trade.closed_at)}${holdPart}`;
}

// ---------------------------------------------------------------------------
// Trade metric cells (header + coach)
// ---------------------------------------------------------------------------

function InsightCell({
  label,
  children,
  className,
  valueClassName,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-card bg-bg-elevated px-3 py-3",
        className,
      )}
    >
      <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {label}
      </p>
      <div
        className={cn(
          "text-[15px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-text",
          valueClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

function BentoCell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        "flex h-full min-w-0 flex-col rounded-card bg-bg-elevated p-3 sm:p-4",
        className,
      )}
    >
      {children}
    </section>
  );
}

function BentoLabel({
  children,
  className,
  tone = "muted",
}: {
  children: ReactNode;
  className?: string;
  tone?: "signal" | "muted";
}) {
  return (
    <p
      className={cn(
        "m-0 text-[10px] font-semibold uppercase tracking-widest",
        tone === "signal" ? "text-signal" : "text-text-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}

function BentoMiniStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <BentoLabel>{label}</BentoLabel>
      <div className="text-[14px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-text">
        {children}
      </div>
    </div>
  );
}

function TradeMetricsBento({
  trade,
  insights,
  currency,
  hasPlan,
  hasContext,
}: {
  trade: TradeDetail;
  insights: TradeInsights;
  currency: string;
  hasPlan: boolean;
  hasContext: boolean;
}) {
  const showPlan = hasPlan || insights.rMultiple != null;
  const net = insights.netPnl;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid auto-rows-[minmax(72px,auto)] grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-12 lg:auto-rows-[minmax(84px,auto)] lg:gap-3">
        <BentoCell className="col-span-2 justify-between sm:col-span-4 lg:col-span-4 lg:row-span-2">
          <BentoLabel tone="signal">P&amp;L</BentoLabel>
          <div className="flex flex-1 flex-col justify-center py-1">
            <p
              className={cn(
                "m-0 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[30px]",
                net != null && net > 0 && "text-profit",
                net != null && net < 0 && "text-loss",
                net === 0 && "text-flat",
                net == null && "text-text-dim",
              )}
            >
              {signedOrDash(insights.netPnl, currency)}
            </p>
            {insights.returnPct != null && (
              <p
                className={cn(
                  "m-0 mt-2 text-sm font-semibold tabular-nums",
                  pnlColor(insights.returnPct),
                )}
              >
                {insights.returnPct >= 0 ? "+" : ""}
                {insights.returnPct.toFixed(2)}%
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2">
            <BentoMiniStat label="Gross">{signedOrDash(insights.grossPnl, currency)}</BentoMiniStat>
            <BentoMiniStat label="Fees">
              <span className="text-text-muted">{moneyOrDash(insights.feesTotal, currency)}</span>
              {insights.feeDragPct != null && (
                <span className="ml-1 text-[10px] font-medium text-text-dim">
                  {(insights.feeDragPct * 100).toFixed(1)}%
                </span>
              )}
            </BentoMiniStat>
          </div>
        </BentoCell>

        <BentoCell className="col-span-2 sm:col-span-4 lg:col-span-3 lg:row-span-2">
          <BentoLabel tone="signal">Execution</BentoLabel>
          <div className="mt-3 grid flex-1 grid-cols-2 content-center gap-x-4 gap-y-4">
            <BentoMiniStat label="Entry">
              {fmtMoney(trade.avg_entry_price, currency, intlLocale())}
            </BentoMiniStat>
            <BentoMiniStat label="Exit">
              {trade.avg_exit_price != null
                ? fmtMoney(trade.avg_exit_price, currency, intlLocale())
                : "—"}
            </BentoMiniStat>
            <BentoMiniStat label="Qty">{insights.qtyOpened}</BentoMiniStat>
            <BentoMiniStat label="Hold">
              {insights.holdLabel === "-" ? "—" : insights.holdLabel}
            </BentoMiniStat>
            {trade.instrument_type === "option" ? (
              <BentoMiniStat label="Mult">×{trade.fills[0]?.multiplier || 100}</BentoMiniStat>
            ) : null}
          </div>
        </BentoCell>

        {showPlan ? (
          <BentoCell className="col-span-2 sm:col-span-4 lg:col-span-5 lg:row-span-2">
            <BentoLabel tone="signal">Plan</BentoLabel>
            <div className="mt-3 grid flex-1 grid-cols-2 content-center gap-x-4 gap-y-4 sm:grid-cols-3">
              <BentoMiniStat label="Risk">
                {insights.initialRisk != null && insights.initialRisk > 0
                  ? moneyOrDash(insights.initialRisk, currency)
                  : "—"}
              </BentoMiniStat>
              <BentoMiniStat label="Target">{moneyOrDash(insights.target, currency)}</BentoMiniStat>
              <BentoMiniStat label="Stop">{moneyOrDash(insights.stop, currency)}</BentoMiniStat>
              <BentoMiniStat label="Breakeven">
                {moneyOrDash(insights.breakeven, currency)}
              </BentoMiniStat>
              <BentoMiniStat label="Planned R:R">
                {insights.plannedRR != null ? `${insights.plannedRR.toFixed(2)}:1` : "—"}
              </BentoMiniStat>
              <BentoMiniStat label="Actual R">
                {insights.rMultiple == null ? (
                  "—"
                ) : (
                  <span className={pnlColor(insights.rMultiple)}>
                    {insights.rMultiple >= 0 ? "+" : ""}
                    {insights.rMultiple.toFixed(2)}R
                  </span>
                )}
              </BentoMiniStat>
            </div>
          </BentoCell>
        ) : (
          <InsightCell
            className="col-span-2 sm:col-span-4 lg:col-span-5 lg:row-span-2"
            label="Actual R"
          >
            {insights.rMultiple == null ? (
              <span className="text-text-dim">—</span>
            ) : (
              <span className={pnlColor(insights.rMultiple)}>
                {insights.rMultiple >= 0 ? "+" : ""}
                {insights.rMultiple.toFixed(2)}R
              </span>
            )}
          </InsightCell>
        )}
      </div>

      {hasContext && (
        <div className="flex flex-wrap items-center gap-2">
          {insights.setupName && (
            <Pill tone="accent">
              <span className="inline-flex items-center gap-1">
                <Zap size={11} strokeWidth={1.75} aria-hidden />
                {insights.setupName}
              </span>
            </Pill>
          )}
          {insights.emotion && <Pill tone="muted">{insights.emotion}</Pill>}
          {insights.setupGrade && <Pill tone="accent">Setup {insights.setupGrade}</Pill>}
          {insights.executionGrade && <Pill tone="accent">Exec {insights.executionGrade}</Pill>}
          {(trade.tags ?? []).map((tag) => (
            <Pill key={tag.id} tone={tag.kind === "mistake" ? "neg" : "muted"}>
              {tag.name}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}

function moneyOrDash(v: number | null, currency: string): string {
  if (v == null) return "—";
  return fmtMoney(v, currency, intlLocale());
}

function signedOrDash(v: number | null, currency: string): ReactNode {
  if (v == null) return <span className="text-text-dim">—</span>;
  return <span className={pnlColor(v)}>{fmtSignedMoney(v, currency, intlLocale())}</span>;
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function TradeHeader({ trade, insights }: { trade: TradeDetail; insights: TradeInsights }) {
  usePrivacyMode();
  useDisplayTimePrefs();
  const currency = trade.pnl_currency;
  const pnl = trade.net_pnl;
  const rMultiple = trade.r_multiple;
  const returnPct = trade.return_pct;
  const outcome = tradeOutcome(trade);
  const hasDividends = trade.dividend_total != null && trade.dividend_total !== 0;
  const hold = insights.holdLabel;
  const timeline = fmtTradeTimeline(trade, hold);
  const market = formatOptionMarketChip(
    trade.instrument_type,
    marketLabel(trade.instrument_type),
    optionContractFromFills(trade.fills),
  );
  const direction = trade.direction.toUpperCase();
  const hasPlan =
    insights.target != null ||
    insights.stop != null ||
    insights.plannedRR != null ||
    insights.initialRisk != null ||
    insights.breakeven != null;
  const hasContext =
    insights.setupName != null ||
    insights.emotion != null ||
    Boolean(insights.setupGrade) ||
    Boolean(insights.executionGrade) ||
    insights.tagNames.length > 0;

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[28px] font-semibold leading-none tracking-[-0.03em] text-text">
                {trade.symbol}
              </span>
              <Pill tone={outcome.tone} title={outcome.label === "FLAT" ? "Break-even" : undefined}>
                {outcome.label}
              </Pill>
              <Pill tone="muted">
                {market} · {direction}
              </Pill>
            </div>
            <p className="m-0 text-xs tabular-nums text-text-muted">{timeline}</p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            {pnl != null ? (
              <span
                className={cn(
                  heroPnlClass(pnl),
                  pnl > 0 && "hero-glow-profit",
                  pnl < 0 && "hero-glow-loss",
                )}
                title="Price P&L (excludes dividends)"
              >
                {fmtSignedMoney(pnl, currency, intlLocale())}
              </span>
            ) : (
              <span className={heroPnlClass(null)}>—</span>
            )}
            <div className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1">
              {returnPct != null && (
                <span className={cn("text-sm font-semibold tabular-nums", pnlColor(returnPct))}>
                  {returnPct >= 0 ? "+" : ""}
                  {returnPct.toFixed(2)}%
                </span>
              )}
              {rMultiple != null ? (
                <span
                  className={cn("text-sm font-semibold tabular-nums", pnlColor(rMultiple))}
                  title="R-multiple (price-based)"
                >
                  {rMultiple >= 0 ? "+" : ""}
                  {rMultiple.toFixed(2)}R
                </span>
              ) : (
                trade.initial_risk == null && (
                  <span className="text-[11px] text-text-dim" title="No initial risk set">
                    No R
                  </span>
                )
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

        <TradeMetricsBento
          trade={trade}
          insights={insights}
          currency={currency}
          hasPlan={hasPlan}
          hasContext={hasContext}
        />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Coach
// ---------------------------------------------------------------------------

function coachToneClass(tone: CoachTone): string {
  switch (tone) {
    case "neg":
      return "text-loss";
    case "warn":
      return "text-signal";
    case "pos":
      return "text-profit";
    default:
      return "text-accent";
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
        <li key={note.id} className="rounded-card bg-bg-elevated px-3 py-2.5">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
            <span className={coachToneClass(note.tone)}>{coachToneLabel(note.tone)}</span>
            <span className="text-text-dim"> · </span>
            {note.headline}
          </p>
          <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-text-muted">{note.detail}</p>
        </li>
      ))}
    </ul>
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
  usePrivacyMode();
  const [open, setOpen] = useState(true);
  const currency = trade.pnl_currency;
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
  const hasExcursion = insights.mae != null || insights.mfe != null;
  const showAskAi = coach.coachConfigured;

  if (coachNotes.length === 0 && !hasExcursion && !coach.isPending) return null;

  const collapsedSummary = coachNotes[0]?.headline ?? (hasExcursion ? "Excursion data" : undefined);
  const errorMsg =
    coach.data?.source === "error"
      ? coach.data.error
      : coach.isError
        ? "Could not reach the coach API"
        : undefined;

  return (
    <section className="flex flex-col rounded-card bg-bg-panel">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className="w-full items-center justify-between gap-4 px-4 py-3"
          aria-label="Coach"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <h2 className="shrink-0 text-[10px] font-semibold tracking-wide text-signal">Coach</h2>
            {hasGenerated ? (
              <span
                className={cn(
                  "shrink-0 rounded-control px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                  usingLlm ? "bg-accent-bg text-accent" : "bg-bg-elevated text-text-muted",
                )}
              >
                {usingLlm ? "AI" : "Rules"}
              </span>
            ) : null}
            {!open && collapsedSummary ? (
              <span className="truncate text-[10px] text-text-muted">{collapsedSummary}</span>
            ) : null}
          </div>
          <CollapsibleChevron />
        </CollapsibleTrigger>
        <CollapsibleContent animation="height">
          <div className="flex flex-col gap-4 px-4 pb-4">
            {showAskAi ? (
              <div className="flex items-center justify-between gap-2">
                <p className="m-0 min-w-0 flex-1 text-[11px] text-text-dim">
                  {coach.isPending
                    ? "Asking the coach…"
                    : usingLlm
                      ? "Generated from this trade via your coach model"
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

            {coach.isPending && !hasGenerated ? (
              <div className="flex flex-col gap-2" aria-busy="true">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : (
              <TradeCoachNotes notes={coachNotes} />
            )}

            {errorMsg && !usingLlm ? (
              <p className="m-0 text-[11px] text-text-muted" role="status">
                {errorMsg}
              </p>
            ) : null}

            {hasExcursion && (
              <div>
                <p className={cn(signalLabelClass, "mb-2")}>Excursion</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <InsightCell label="MAE">{signedOrDash(insights.mae, currency)}</InsightCell>
                  <InsightCell label="MFE">{signedOrDash(insights.mfe, currency)}</InsightCell>
                  <InsightCell label="Capture">
                    {insights.mfeCapturePct == null ? (
                      <span className="text-text-dim">—</span>
                    ) : (
                      <span className={pnlColor(insights.mfeCapturePct)}>
                        {(insights.mfeCapturePct * 100).toFixed(0)}%
                      </span>
                    )}
                  </InsightCell>
                  <InsightCell label="Left on table">
                    {insights.leftOnTable == null ? (
                      <span className="text-text-dim">—</span>
                    ) : (
                      <span
                        className={cn(
                          insights.leftOnTable > 0
                            ? "text-text-muted"
                            : pnlColor(insights.leftOnTable),
                        )}
                      >
                        {fmtSignedMoney(insights.leftOnTable, currency, intlLocale())}
                      </span>
                    )}
                  </InsightCell>
                </div>
              </div>
            )}
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
          <SignalToggle
            key={tag.id}
            pressed={active}
            tone={tone}
            onPressedChange={() => onToggle(tag.id)}
            aria-label={tag.name}
          >
            {tag.name}
          </SignalToggle>
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
      <p className={signalLabelClass}>{label}</p>
      <div className="text-[13px] leading-relaxed text-text">{children}</div>
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
  const dash = <span className="text-text-dim">—</span>;

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
        <p className={signalLabelClass}>Setups</p>
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
          <p className={signalLabelClass}>Tags</p>
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
          <p className={signalLabelClass}>Mistake type</p>
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
        <div className="flex items-center justify-between gap-3 rounded-control bg-bg-hover px-3 py-2">
          <span className="text-[11px] text-text-muted">Unsaved draft restored.</span>
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
        <p className={signalLabelClass}>Setups (select multiple)</p>
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
                <SignalToggle key={s.id} pressed={on} onPressedChange={() => toggleSetup(s.id)}>
                  {on && idx === 0 ? `${s.name} · main` : s.name}
                </SignalToggle>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className={signalLabelClass}>Session</p>
        <div className="flex flex-wrap gap-1.5">
          {TRADE_SESSIONS.map((s) => {
            const on = form.session === s;
            return (
              <SignalToggle
                key={s}
                pressed={on}
                onPressedChange={() => setForm((f) => ({ ...f, session: on ? "" : s }))}
                aria-label={`Session ${s}`}
              >
                {s}
              </SignalToggle>
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
          <SignalAmountInput
            id="trade-risk"
            value={form.initial_risk}
            onValueChange={(initial_risk) => setForm((f) => ({ ...f, initial_risk }))}
            placeholder="0.00"
          />
        </SignalField>
        <SignalField label="Target" htmlFor="trade-target">
          <SignalAmountInput
            id="trade-target"
            value={form.target_price}
            onValueChange={(target_price) => setForm((f) => ({ ...f, target_price }))}
            placeholder="Target"
          />
        </SignalField>
        <SignalField label="Stop" htmlFor="trade-stop">
          <SignalAmountInput
            id="trade-stop"
            value={form.stop_price}
            onValueChange={(stop_price) => setForm((f) => ({ ...f, stop_price }))}
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
          <SignalAmountInput
            id="trade-mae"
            value={form.mae}
            onValueChange={(mae) => setForm((f) => ({ ...f, mae }))}
            placeholder="Max adverse"
            allowNegative
          />
        </SignalField>
        <SignalField label="MFE ($)" htmlFor="trade-mfe">
          <SignalAmountInput
            id="trade-mfe"
            value={form.mfe}
            onValueChange={(mfe) => setForm((f) => ({ ...f, mfe }))}
            placeholder="Max favorable"
            allowNegative
          />
        </SignalField>
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
  const [typedConfirm, setTypedConfirm] = useState("");
  const confirmInputId = useId();

  if (loading) {
    return (
      <Page fill>
        <Card>
          <Skeleton height="96px" />
        </Card>
        <Card>
          <Skeleton height="280px" />
        </Card>
        <Card>
          <Skeleton height="420px" />
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
        <div className="flex shrink-0 items-center gap-1.5">
          {onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label="Edit trade"
              title="Edit trade"
              onClick={onEdit}
              disabled={deleting}
            >
              <Pencil size={15} strokeWidth={1.5} aria-hidden />
            </Button>
          )}
          {onDelete ? (
            <Button
              type="button"
              variant="destructive"
              size="icon-sm"
              aria-label="Remove trade"
              title="Remove trade"
              onClick={() => setDeleteOpen(true)}
              disabled={deleting}
            >
              <Trash2 size={15} strokeWidth={1.5} aria-hidden />
            </Button>
          ) : null}
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
                className="border-transparent bg-loss/15 hover:bg-loss/25"
              >
                {deleting ? "Removing…" : "Remove trade"}
              </Button>
            </>
          }
        >
          <p className="m-0 text-[13px] leading-relaxed text-text-muted">
            Permanently deletes this trade and all of its fills. This cannot be undone.
          </p>
          <div>
            <label htmlFor={confirmInputId} className="mb-1.5 block text-[11px] text-text-dim">
              Type <span className="font-medium text-text">{trade.symbol}</span> to confirm
            </label>
            <SignalInput
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

      <TradeHeader trade={trade} insights={insights} />

      <Card flush className="pt-4">
        <TradeChartSection trade={trade} />
      </Card>

      <TradeCoachPanel trade={trade} insights={insights} />
    </Page>
  );
}
