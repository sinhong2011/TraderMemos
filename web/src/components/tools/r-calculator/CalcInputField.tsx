import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";

/** Trim float dust from stepping (0.05 + 0.25 → 0.30000000000000004) without losing real precision. */
const clean = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Labelled numeric field for the calculators — coss `NumberField` chrome so it
 * matches Input / NativeSelect / date triggers, with an optional unit adornment.
 */
export function CalcInputField({
  label,
  value,
  onValue,
  step = 1,
  min,
  max,
  prefix,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onValue: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
  hint?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <NumberField
      id={id}
      className="gap-1.5"
      value={Number.isFinite(value) ? value : null}
      onValueChange={(next) => onValue(next == null ? 0 : clean(next))}
      step={step}
      min={min}
      max={max}
    >
      <Label htmlFor={id} className="text-[13px] font-medium text-muted-foreground">
        {label}
      </Label>
      <NumberFieldGroup>
        <NumberFieldDecrement aria-label={`Decrease ${label}`} />
        <span className="flex min-w-0 flex-1 items-center gap-1">
          {prefix ? <span className="shrink-0 text-muted-foreground">{prefix}</span> : null}
          {/* Prices and R values are fractional — keep the decimal keypad on mobile. */}
          <NumberFieldInput
            inputMode="decimal"
            aria-describedby={hintId}
            className="px-0 text-right"
          />
          {suffix ? <span className="shrink-0 text-muted-foreground">{suffix}</span> : null}
        </span>
        <NumberFieldIncrement aria-label={`Increase ${label}`} />
      </NumberFieldGroup>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </NumberField>
  );
}
