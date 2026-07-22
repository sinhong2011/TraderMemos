import { forwardRef, type ComponentProps, type KeyboardEvent } from "react";
import { cn } from "../lib/cn";
import {
  normalizeAmountInput,
  sanitizeAmountInput,
  type AmountInputOptions,
} from "../lib/amountInput";
import { signalInputClass } from "./signal-field-styles";

function isAllowedAmountKey(e: KeyboardEvent<HTMLInputElement>, allowNegative: boolean): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (
    e.key === "Backspace" ||
    e.key === "Delete" ||
    e.key === "Tab" ||
    e.key === "Enter" ||
    e.key === "Escape" ||
    e.key === "ArrowLeft" ||
    e.key === "ArrowRight" ||
    e.key === "ArrowUp" ||
    e.key === "ArrowDown" ||
    e.key === "Home" ||
    e.key === "End"
  ) {
    return true;
  }
  if (e.key === "." || e.key === ",") return true;
  if (allowNegative && e.key === "-") return true;
  return /^\d$/.test(e.key);
}

export type SignalAmountInputProps = Omit<
  ComponentProps<"input">,
  "type" | "inputMode" | "value" | "onChange" | "defaultValue"
> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Dense chip for fill rows (Fee / Comm / Qty). */
  compact?: boolean;
  allowNegative?: AmountInputOptions["allowNegative"];
  /** Normalize via BigNumber on blur (default true). */
  normalizeOnBlur?: boolean;
};

/**
 * Decimal amount field — string-controlled for partial typing (`12.`), parsed with bignumber.js.
 */
export const SignalAmountInput = forwardRef<HTMLInputElement, SignalAmountInputProps>(
  function SignalAmountInput(
    {
      value,
      onValueChange,
      compact = false,
      allowNegative = false,
      normalizeOnBlur = true,
      className,
      onBlur,
      ...props
    },
    ref,
  ) {
    return (
      <input
        ref={ref}
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onKeyDown={(e) => {
          if (!isAllowedAmountKey(e, allowNegative)) e.preventDefault();
          props.onKeyDown?.(e);
        }}
        onChange={(e) => {
          const next = sanitizeAmountInput(e.target.value, { allowNegative });
          if (e.target.value !== next) e.target.value = next;
          onValueChange(next);
        }}
        onBlur={(e) => {
          if (normalizeOnBlur) {
            const next = normalizeAmountInput(value);
            if (next !== value) onValueChange(next);
          }
          onBlur?.(e);
        }}
        className={cn(
          signalInputClass,
          compact && "min-w-0 px-2 text-[12px] tabular-nums",
          className,
        )}
      />
    );
  },
);
