import { cn } from "../lib/cn";
import { type TradeGrade, TRADE_GRADES } from "../lib/tradeGrades";

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
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {label}
      </p>
      {hint ? <p className="mb-2 text-[10px] leading-snug text-text-dim">{hint}</p> : null}
      <div role="radiogroup" aria-label={label} className="flex h-10 gap-1">
        {TRADE_GRADES.map((g) => {
          const selected = value === g;
          return (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${label} ${g}`}
              onClick={() => onChange(selected ? "" : g)}
              className={cn(
                "h-full flex-1 cursor-pointer rounded-control text-[12px] font-semibold tabular-nums transition-colors duration-150",
                selected
                  ? "bg-accent-bg text-accent"
                  : "bg-bg-input text-text-muted hover:bg-bg-input-hover hover:text-text",
              )}
            >
              {g}
            </button>
          );
        })}
      </div>
    </div>
  );
}
