import { type TradeGrade, TRADE_GRADES } from "../lib/tradeGrades";
import { Button } from "./ui/button";

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
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      {hint ? <p className="mb-2 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
      <div role="radiogroup" aria-label={label} className="flex h-10 gap-1">
        {TRADE_GRADES.map((g) => {
          const selected = value === g;
          return (
            <Button
              key={g}
              type="button"
              variant={selected ? "soft" : "secondary"}
              role="radio"
              aria-checked={selected}
              aria-label={`${label} ${g}`}
              onClick={() => onChange(selected ? "" : g)}
              className="h-full flex-1 font-semibold tabular-nums"
            >
              {g}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
