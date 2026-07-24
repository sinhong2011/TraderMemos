import { Minus, Plus } from "lucide-react";
import { signalLabelClass } from "../../signal-field-styles";
import { cn } from "../../../lib/cn";
import { Button } from "../../ui/button";

export function CalcInputField({
  label,
  value,
  onValue,
  step = 1,
  min,
  prefix,
  suffix,
  hint,
  accent = "accent",
}: {
  label: string;
  value: number;
  onValue: (n: number) => void;
  step?: number;
  min?: number;
  prefix?: string;
  suffix?: string;
  hint?: string;
  accent?: "accent" | "profit" | "loss" | "signal";
}) {
  const accentRing =
    accent === "profit"
      ? "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-profit"
      : accent === "loss"
        ? "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-destructive"
        : accent === "signal"
          ? "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-signal"
          : "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring";

  const bump = (delta: number) => {
    const next = Math.round((value + delta) * 1000) / 1000;
    if (min != null && next < min) return;
    onValue(next);
  };

  return (
    <div>
      <label className={signalLabelClass}>{label}</label>
      <div
        className={cn(
          "flex items-center rounded-md border-none bg-muted transition-[background-color] duration-150 hover:bg-accent",
          accentRing,
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Decrease"
          onClick={() => bump(-step)}
          className="h-8 w-7 rounded-none text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <Minus size={12} />
        </Button>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-0.5 pr-1">
          {prefix ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">{prefix}</span>
          ) : null}
          <input
            type="text"
            inputMode="decimal"
            value={Number.isFinite(value) ? value : ""}
            onChange={(e) => {
              const n = Number.parseFloat(e.target.value);
              if (Number.isFinite(n)) onValue(n);
              else if (e.target.value === "") onValue(0);
            }}
            className="w-full min-w-0 bg-transparent py-1.5 text-right text-xs tabular-nums text-foreground outline-none"
          />
          {suffix ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">{suffix}</span>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Increase"
          onClick={() => bump(step)}
          className="h-8 w-7 rounded-none text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <Plus size={12} />
        </Button>
      </div>
      {hint ? <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
