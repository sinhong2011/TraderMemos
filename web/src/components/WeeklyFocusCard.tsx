import { Target } from "lucide-react";
import { Card } from "./Card";

export interface WeeklyFocusCardProps {
  items: string[];
  /** Opens the weekly review that set the focus. */
  onOpenReview?: () => void;
}

/**
 * This week's focus, set in the last weekly review — one to three behaviors to
 * hold this week. No checkboxes: a focus is how you trade, not a task to tick;
 * whether it held is answered in the next review.
 */
export function WeeklyFocusCard({ items, onOpenReview }: WeeklyFocusCardProps) {
  if (items.length === 0) return null;
  return (
    <Card
      title={
        <h2 className="m-0 flex items-center gap-1.5 text-xs font-medium text-heading">
          <Target size={13} strokeWidth={2} aria-hidden />
          This week's focus
        </h2>
      }
      action={
        onOpenReview ? (
          <button
            type="button"
            onClick={onOpenReview}
            className="cursor-pointer rounded-sm text-[12px] text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            From your weekly review
          </button>
        ) : null
      }
    >
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((item, i) => (
          <li key={`${i}-${item}`} className="flex items-baseline gap-3">
            <span className="w-4 shrink-0 text-right text-[13px] font-semibold tabular-nums text-muted-foreground">
              {i + 1}
            </span>
            <span className="text-[15px] leading-snug font-medium text-foreground">{item}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
