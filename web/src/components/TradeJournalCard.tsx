import { NotebookPen, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "./Card";
import { Pill } from "./Pill";
import { Button } from "./ui/button";
import type { TradeDetail } from "@/lib/api/types";
import { parseJournalNotes } from "@/lib/journalNotes";
import { gradeFromInt } from "@/lib/tradeGrades";

function JournalBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="m-0 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p className="m-0 text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">
        {children}
      </p>
    </div>
  );
}

export interface TradeJournalCardProps {
  trade: TradeDetail;
  /** Opens the edit drawer, which owns all journal editing. */
  onEdit?: () => void;
}

/**
 * The trader's own account of the trade — setup, session, emotion, grades, and
 * the entry/exit/review narrative.
 *
 * This is the point of a journal, and it was reachable only by opening the edit
 * drawer: the detail page rendered every derived metric but none of what the
 * trader actually wrote. Read-only here by design — editing stays in the drawer
 * so there is one form, not two.
 */
export function TradeJournalCard({ trade, onEdit }: TradeJournalCardProps) {
  const journal = parseJournalNotes(trade.notes ?? "");
  const setupGrade = gradeFromInt(trade.confidence);
  const execGrade = gradeFromInt(trade.trade_quality);
  const emotion = trade.emotional_state?.trim() ?? "";
  const tags = trade.tags ?? [];

  const hasContext =
    Boolean(trade.setup) ||
    Boolean(journal.session) ||
    Boolean(emotion) ||
    Boolean(setupGrade) ||
    Boolean(execGrade) ||
    tags.length > 0;
  const hasNarrative = Boolean(
    journal.entryReason || journal.exitReason || journal.reviewNotes || journal.legacy,
  );

  const editAction = onEdit ? (
    <Button type="button" variant="link" onClick={onEdit} className="h-auto text-xs">
      {hasContext || hasNarrative ? "Edit journal" : "Write review"}
    </Button>
  ) : undefined;

  if (!hasContext && !hasNarrative) {
    return (
      <Card title="Journal" action={editAction}>
        <p className="m-0 flex items-center gap-2 text-[13px] leading-relaxed text-muted-foreground">
          <NotebookPen size={15} strokeWidth={1.5} aria-hidden />
          Nothing written yet — record why you entered and exited while it is still fresh.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Journal" action={editAction}>
      <div className="flex flex-col gap-4">
        {hasContext && (
          <div className="flex flex-wrap items-center gap-1.5">
            {trade.setup ? (
              <Pill tone="accent">
                <Zap size={11} strokeWidth={1.75} aria-hidden />
                {trade.setup.name}
              </Pill>
            ) : null}
            {journal.session ? <Pill tone="muted">{journal.session}</Pill> : null}
            {emotion ? <Pill tone="muted">{emotion}</Pill> : null}
            {setupGrade ? <Pill tone="accent">Setup {setupGrade}</Pill> : null}
            {execGrade ? <Pill tone="accent">Exec {execGrade}</Pill> : null}
            {tags.map((tag) => (
              <Pill key={tag.id} tone={tag.kind === "mistake" ? "neg" : "muted"}>
                {tag.name}
              </Pill>
            ))}
          </div>
        )}

        {journal.entryReason ? (
          <JournalBlock label="Entry reason">{journal.entryReason}</JournalBlock>
        ) : null}
        {journal.exitReason ? (
          <JournalBlock label="Exit reason">{journal.exitReason}</JournalBlock>
        ) : null}
        {journal.reviewNotes ? (
          <JournalBlock label="Review notes">{journal.reviewNotes}</JournalBlock>
        ) : null}
        {/* Notes written before the structured template still have to show up. */}
        {journal.legacy ? <JournalBlock label="Notes">{journal.legacy}</JournalBlock> : null}
      </div>
    </Card>
  );
}
