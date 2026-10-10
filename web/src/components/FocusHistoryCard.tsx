import { Check, Circle } from "lucide-react";
import type { FocusHistory } from "@/lib/api/focus";
import { fmtPct } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { StatCard } from "./StatCard";

export interface FocusHistoryCardProps {
  history?: FocusHistory;
  loading: boolean;
  error: boolean;
  /** Opens the weekly review that scored a week. */
  onOpenNote?: (noteId: string) => void;
}

const TITLE = "Weekly focus";

/** "Sep 28 – Oct 4" for the week starting on a YYYY-MM-DD Monday. */
function weekLabel(weekStart: string, locale: string): string {
  // Noon anchor: a date-only string parsed at midnight can land on the
  // previous day west of UTC.
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

/**
 * "Do I hold the focus I set?" — each weekly review's "Last week's focus"
 * checklist, scored. A ticked item was kept; an unticked one was missed or
 * never scored, and the copy says so rather than calling it a miss.
 */
export function FocusHistoryCard({ history, loading, error, onOpenNote }: FocusHistoryCardProps) {
  const locale = intlLocale();

  if (loading) {
    return (
      <Card title={TITLE}>
        <Skeleton height="160px" />
      </Card>
    );
  }
  if (error) {
    return (
      <Card title={TITLE}>
        <p className="m-0 text-xs text-destructive">Failed to load focus history.</p>
      </Card>
    );
  }
  if (!history || history.weeks.length === 0) {
    return (
      <Card title={TITLE}>
        <EmptyState
          title="No scored weeks in this range"
          hint="Each weekly review lists last week's focus as a checklist — tick what you kept and it shows up here."
        />
      </Card>
    );
  }

  const weeks = history.weeks.length;
  return (
    <Card
      title={TITLE}
      description="How often you held the focus you set, from the checklist in each weekly review."
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard
            label="Items kept"
            value={`${history.items_kept} of ${history.items_total}`}
            hint={fmtPct(history.items_kept / history.items_total, locale)}
          />
          <StatCard
            label="Weeks fully kept"
            value={`${history.weeks_all_kept} of ${weeks}`}
            hint={weeks === 1 ? "1 scored week" : `${weeks} scored weeks`}
          />
        </div>
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {history.weeks.map((week) => (
            <li key={week.week_start} className="flex flex-col gap-1.5">
              {onOpenNote ? (
                <button
                  type="button"
                  onClick={() => onOpenNote(week.note_id)}
                  className="w-fit cursor-pointer rounded-sm text-[12px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {weekLabel(week.week_start, locale)}
                </button>
              ) : (
                <span className="text-[12px] font-medium text-muted-foreground">
                  {weekLabel(week.week_start, locale)}
                </span>
              )}
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {week.items.map((item, i) => (
                  <li key={`${i}-${item.text}`} className="flex items-baseline gap-2">
                    {item.kept ? (
                      <Check
                        size={14}
                        strokeWidth={2.5}
                        className="shrink-0 translate-y-0.5 text-profit"
                        aria-label="Kept"
                      />
                    ) : (
                      <Circle
                        size={12}
                        strokeWidth={2}
                        className="mx-px shrink-0 translate-y-px text-muted-foreground"
                        aria-label="Not ticked"
                      />
                    )}
                    <span
                      className={
                        item.kept
                          ? "text-[14px] text-foreground"
                          : "text-[14px] text-muted-foreground"
                      }
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
