import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Page } from "@/components/Page";
import { Pill } from "@/components/Pill";
import { Skeleton } from "@/components/Skeleton";
import { pnlColor } from "@/components/theme-tokens";
import { Button } from "@/components/ui/button";
import type { Tag, Trade, TradeDetail } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { fmtDateTime } from "@/lib/format";
import { buildStructuredJournalNotes, parseJournalNotes } from "@/lib/journalNotes";
import { intlLocale } from "@/lib/locale";
import { gradeFromInt, intFromGrade, TRADE_GRADES, type TradeGrade } from "@/lib/tradeGrades";
import { useMoneyFormatters } from "@/lib/useMoneyFormatters";

export interface ReviewSave {
  trade_quality: number;
  notes: string;
  tag_ids: string[];
}

export interface ReviewInboxViewProps {
  items: Trade[];
  loading: boolean;
  error: boolean;
  backlog: number;
  windowDays: number;
  /** Detail of the trade on screen (notes and tags to merge into). */
  detail?: TradeDetail;
  detailLoading: boolean;
  mistakeTags: Tag[];
  /** Index into items of the trade on screen. */
  index: number;
  onIndexChange: (index: number) => void;
  onSave: (tradeId: string, body: ReviewSave) => Promise<void>;
  saving: boolean;
  onDismissBacklog: () => Promise<void>;
  dismissing: boolean;
  reviewedThisSession: number;
}

/**
 * One trade at a time: grade it, write the lesson, tick the mistakes, next.
 * A grade alone clears a trade — the lesson and mistakes are encouraged, not
 * required, so clearing the inbox stays a two-second habit. Keys: 1–5 grade
 * (A+ … C), Enter saves, → skips, ← goes back.
 */
export function ReviewInboxView(props: ReviewInboxViewProps) {
  const { items, loading, error, backlog, windowDays, index, onIndexChange } = props;

  const header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="m-0 text-[17px] font-semibold tracking-tight text-foreground">Review</h1>
        <p className="m-0 mt-0.5 text-[12px] text-muted-foreground tabular-nums">
          {loading
            ? "Loading…"
            : `${items.length} to review · last ${windowDays} days${
                props.reviewedThisSession > 0 ? ` · ${props.reviewedThisSession} done now` : ""
              }`}
        </p>
      </div>
      {backlog > 0 ? <BacklogControl {...props} /> : null}
    </header>
  );

  if (loading) {
    return (
      <Page>
        {header}
        <Card>
          <Skeleton height="260px" />
        </Card>
      </Page>
    );
  }
  if (error) {
    return (
      <Page>
        {header}
        <Card>
          <p className="m-0 text-xs text-destructive">Failed to load the review inbox.</p>
        </Card>
      </Page>
    );
  }
  if (items.length === 0) {
    return (
      <Page>
        {header}
        <Card>
          <EmptyState
            title="Inbox zero"
            hint={
              props.reviewedThisSession > 0
                ? `${props.reviewedThisSession} trade${props.reviewedThisSession === 1 ? "" : "s"} reviewed. Every closed trade from the last ${windowDays} days has a grade.`
                : `Every closed trade from the last ${windowDays} days has a grade.`
            }
            icon={<CheckCircle2 size={28} strokeWidth={1.5} />}
          />
        </Card>
      </Page>
    );
  }
  if (index >= items.length) {
    return (
      <Page>
        {header}
        <Card>
          <EmptyState
            title={`${items.length} skipped`}
            hint="You went past the end of the queue. The trades you skipped are still waiting."
            actions={
              <Button type="button" variant="outline" onClick={() => onIndexChange(0)}>
                Start over
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      {header}
      <ReviewCard
        key={items[index].id}
        trade={items[index]}
        position={index}
        total={items.length}
        {...props}
      />
    </Page>
  );
}

function BacklogControl({ backlog, onDismissBacklog, dismissing }: ReviewInboxViewProps) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex items-center gap-2 text-[12px] text-muted-foreground tabular-nums">
      <span>
        {backlog} older trade{backlog === 1 ? "" : "s"} never reviewed
      </span>
      {confirm ? (
        <>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={dismissing}
            onClick={async () => {
              await onDismissBacklog();
              setConfirm(false);
            }}
          >
            Stop counting them
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button type="button" size="xs" variant="ghost" onClick={() => setConfirm(true)}>
          Dismiss
        </Button>
      )}
    </div>
  );
}

function ReviewCard({
  trade,
  position,
  total,
  detail,
  detailLoading,
  mistakeTags,
  onIndexChange,
  onSave,
  saving,
}: ReviewInboxViewProps & { trade: Trade; position: number; total: number }) {
  const { fmtSignedMoney } = useMoneyFormatters();
  const locale = intlLocale();
  const ready = detail != null && detail.id === trade.id;
  const [grade, setGrade] = useState<TradeGrade | "">("");
  const [lesson, setLesson] = useState("");
  const [mistakes, setMistakes] = useState<Set<string>>(new Set());
  const seeded = useRef(false);
  const lessonRef = useRef<HTMLInputElement>(null);

  // Seed the form once from the trade's journal (a lesson or tags may exist).
  useEffect(() => {
    if (!ready || seeded.current) return;
    seeded.current = true;
    setGrade(gradeFromInt(detail.trade_quality));
    setLesson(parseJournalNotes(detail.notes ?? "").reviewNotes);
    setMistakes(new Set(detail.tags.filter((t) => t.kind === "mistake").map((t) => t.id)));
  }, [ready, detail]);

  const canSave = ready && grade !== "" && !saving;

  async function save() {
    if (!canSave || !detail) return;
    const parsed = parseJournalNotes(detail.notes ?? "");
    const notes = buildStructuredJournalNotes({ ...parsed, reviewNotes: lesson });
    const kept = detail.tags.filter((t) => t.kind !== "mistake").map((t) => t.id);
    await onSave(trade.id, {
      trade_quality: intFromGrade(grade) as number,
      notes,
      tag_ids: [...kept, ...mistakes],
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const typing = document.activeElement === lessonRef.current;
      if (e.key === "Enter") {
        e.preventDefault();
        void save();
        return;
      }
      if (typing) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) {
        setGrade(TRADE_GRADES[n - 1]);
      } else if (e.key === "ArrowRight") {
        onIndexChange(position + 1);
      } else if (e.key === "ArrowLeft" && position > 0) {
        onIndexChange(position - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const net = trade.net_pnl ?? 0;
  const r = ready ? detail.r_multiple : null;

  return (
    <Card>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[20px] font-semibold tracking-tight text-foreground">
                {trade.symbol}
              </span>
              <Pill tone="muted" className="px-1.5 py-0 text-2xs uppercase">
                {trade.direction}
              </Pill>
              {ready && detail.setup ? (
                <Pill tone="accent" className="px-1.5 py-0 text-2xs">
                  {detail.setup.name}
                </Pill>
              ) : null}
            </div>
            <p className="m-0 mt-1 text-[12px] text-muted-foreground tabular-nums">
              {trade.closed_at ? fmtDateTime(trade.closed_at, locale) : ""} ·{" "}
              {trade.avg_entry_price} → {trade.avg_exit_price ?? ""}
            </p>
          </div>
          <div className="text-right tabular-nums">
            <p className={cn("m-0 text-[22px] font-semibold tracking-tight", pnlColor(net))}>
              {fmtSignedMoney(net, trade.pnl_currency, locale)}
            </p>
            {r != null ? (
              <p className={cn("m-0 text-[12px] font-medium", pnlColor(r))}>
                {r > 0 ? "+" : ""}
                {r.toFixed(2)}R
              </p>
            ) : null}
          </div>
        </div>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
            Execution grade
          </legend>
          <div role="radiogroup" aria-label="Execution grade" className="flex flex-wrap gap-2">
            {TRADE_GRADES.map((g, i) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={grade === g}
                onClick={() => setGrade(grade === g ? "" : g)}
                className={cn(
                  "flex h-11 min-w-14 cursor-pointer flex-col items-center justify-center rounded-lg px-3",
                  "text-[15px] font-semibold transition-colors duration-150 motion-reduce:transition-none",
                  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  grade === g
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-accent",
                )}
              >
                {g}
                <span
                  className={cn(
                    "text-2xs font-normal",
                    grade === g ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
            Lesson
          </span>
          <input
            ref={lessonRef}
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
            placeholder="One line you'd tell yourself before the next trade"
            className="h-9 rounded-lg border border-input bg-background px-3 text-[14px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        {mistakeTags.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
              Mistakes
            </span>
            <div className="flex flex-wrap gap-1.5">
              {mistakeTags.map((tag) => {
                const on = mistakes.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const next = new Set(mistakes);
                      if (on) next.delete(tag.id);
                      else next.add(tag.id);
                      setMistakes(next);
                    }}
                    className={cn(
                      "cursor-pointer rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors duration-150",
                      "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      on
                        ? "bg-loss/15 text-loss"
                        : "bg-muted text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={position === 0}
              onClick={() => onIndexChange(position - 1)}
            >
              <ArrowLeft size={14} strokeWidth={1.75} />
              Back
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onIndexChange(position + 1)}
            >
              Skip
              <ArrowRight size={14} strokeWidth={1.75} />
            </Button>
            <Link
              to="/trades/$id"
              params={{ id: trade.id }}
              className="ml-1 inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
            >
              Open trade <ExternalLink size={12} strokeWidth={1.75} />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-muted-foreground tabular-nums">
              {position + 1} of {total}
            </span>
            <Button type="button" disabled={!canSave} onClick={() => void save()}>
              {saving ? "Saving…" : "Save & next"}
            </Button>
          </div>
        </div>
        {detailLoading && !ready ? (
          <p className="m-0 text-2xs text-muted-foreground">Loading the trade's journal…</p>
        ) : null}
      </div>
    </Card>
  );
}
