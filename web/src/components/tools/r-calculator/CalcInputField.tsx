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
        ? "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-loss"
        : accent === "signal"
          ? "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-signal"
          : "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-border-strong";

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
          "flex items-center rounded-control border-none bg-bg-input transition-[background-color] duration-150 hover:bg-bg-input-hover",
          accentRing,
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Decrease"
          onClick={() => bump(-step)}
          className="h-8 w-7 rounded-none text-text-dim hover:bg-transparent hover:text-text"
        >
          <Minus size={12} />
        </Button>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-0.5 pr-1">
          {prefix ? <span className="shrink-0 text-[11px] text-text-dim">{prefix}</span> : null}
          <input
            type="text"
            inputMode="decimal"
            value={Number.isFinite(value) ? value : ""}
            onChange={(e) => {
              const n = Number.parseFloat(e.target.value);
              if (Number.isFinite(n)) onValue(n);
              else if (e.target.value === "") onValue(0);
            }}
            className="w-full min-w-0 bg-transparent py-1.5 text-right text-xs tabular-nums text-text outline-none"
          />
          {suffix ? <span className="shrink-0 text-[11px] text-text-dim">{suffix}</span> : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Increase"
          onClick={() => bump(step)}
          className="h-8 w-7 rounded-none text-text-dim hover:bg-transparent hover:text-text"
        >
          <Plus size={12} />
        </Button>
      </div>
      {hint ? <p className="mt-1 text-[10px] text-text-dim">{hint}</p> : null}
    </div>
  );
}
