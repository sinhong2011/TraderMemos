import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { gradeFromInt, intFromGrade, type TradeGrade, TRADE_GRADES } from "@/lib/tradeGrades";

/** Ascending score order (C → A+) so the stars fill left to right. */
const SCORES = TRADE_GRADES.map((g) => intFromGrade(g) as number).sort((a, b) => a - b);

/**
 * Interactive star rating for the journal grades. Stars carry the magnitude,
 * the letter beside them carries the grade — the underlying value stays a
 * `TradeGrade`, so `intFromGrade` / `gradeFromInt` remain the only mapping.
 * Clicking the current grade clears it.
 */
export function GradeControl({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: TradeGrade | "";
  onChange: (grade: TradeGrade | "") => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const score = intFromGrade(value) ?? 0;
  // Hover/focus previews the grade under the pointer without committing it.
  const preview = hovered ?? score;
  const previewGrade = gradeFromInt(preview);

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      {hint ? <p className="mb-2 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
      <div className="flex items-center gap-2.5">
        <div
          role="radiogroup"
          aria-label={label}
          className="flex items-center gap-0.5"
          onMouseLeave={() => setHovered(null)}
        >
          {SCORES.map((star) => {
            const grade = gradeFromInt(star) as TradeGrade;
            const selected = score === star;
            const filled = preview >= star;
            return (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${label} ${grade}`}
                onClick={() => onChange(selected ? "" : grade)}
                onMouseEnter={() => setHovered(star)}
                onFocus={() => setHovered(star)}
                onBlur={() => setHovered(null)}
                className={cn(
                  "inline-flex size-9.5 cursor-pointer items-center justify-center rounded-md outline-none",
                  "transition-colors duration-150 ease-out motion-reduce:transition-none",
                  "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring sm:size-8.5",
                )}
              >
                <Star
                  size={22}
                  strokeWidth={1.75}
                  aria-hidden
                  className={cn(
                    "transition-colors duration-150 ease-out motion-reduce:transition-none",
                    filled
                      ? "fill-warning text-warning"
                      : "fill-transparent text-muted-foreground/40",
                  )}
                />
              </button>
            );
          })}
        </div>
        <span
          aria-live="polite"
          className={cn(
            "min-w-7 text-[15px] font-semibold tabular-nums",
            previewGrade ? "text-foreground" : "text-muted-foreground/72",
          )}
        >
          {previewGrade || "—"}
        </span>
      </div>
    </div>
  );
}
