import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import {
  signalFieldErrorClass,
  signalFieldHintClass,
  signalLabelClass,
} from "./signal-field-styles";

export function SignalField({
  label,
  htmlFor,
  description,
  error,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  description?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      {label && (
        <label htmlFor={htmlFor} className={signalLabelClass}>
          {label}
        </label>
      )}
      {children}
      {description && !error && <p className={signalFieldHintClass}>{description}</p>}
      {error && <p className={signalFieldErrorClass}>{error}</p>}
    </div>
  );
}

/** First TanStack Form field error as display string. */
export function fieldError(errors: unknown[] | undefined): string | undefined {
  if (!errors?.length) return undefined;
  const first = errors[0];
  return typeof first === "string" ? first : String(first);
}
