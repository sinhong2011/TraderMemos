import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import {
  Field as UiField,
  FieldDescription,
  FieldError as UiFieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fieldErrorClass, fieldHintClass, fieldLabelClass } from "@/components/field-styles";
import { cn } from "@/lib/cn";

export function Field({
  label,
  htmlFor,
  description,
  info,
  error,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  /** Helper text below the control. */
  description?: ReactNode;
  /** Tooltip next to the label (info icon). */
  info?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <UiField data-invalid={error ? true : undefined} className={cn("gap-2.5", className)}>
      {label ? (
        <div className="flex items-center gap-1">
          <FieldLabel htmlFor={htmlFor} className={cn(fieldLabelClass, "mb-0 inline")}>
            {label}
          </FieldLabel>
          {info ? (
            <Tooltip>
              <TooltipTrigger
                // Help icons are often tapped; default closeOnClick would dismiss on the same press.
                delay={200}
                closeOnClick={false}
                render={
                  <button
                    type="button"
                    className={cn(
                      "inline-flex size-4 shrink-0 items-center justify-center rounded-sm",
                      "text-muted-foreground transition-colors hover:text-foreground",
                      "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    )}
                    aria-label={`About ${label}`}
                  />
                }
              >
                <CircleHelp className="size-3" strokeWidth={1.75} aria-hidden />
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="start"
                className={cn(
                  // Default TooltipContent is inline-flex (for short labels) — prose needs a block.
                  "block max-w-[16rem] whitespace-normal px-2.5 py-1.5",
                  "text-left text-xs leading-relaxed tracking-normal text-popover-foreground",
                  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.95em]",
                )}
              >
                <span className="block text-pretty">{info}</span>
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      ) : null}
      {children}
      {description && !error ? (
        <FieldDescription className={cn(fieldHintClass, "mt-0")}>{description}</FieldDescription>
      ) : null}
      {error ? <UiFieldError className={cn(fieldErrorClass, "mt-0")}>{error}</UiFieldError> : null}
    </UiField>
  );
}

/** First TanStack Form field error as display string. */
export function fieldError(errors: unknown[] | undefined): string | undefined {
  if (!errors?.length) return undefined;
  const first = errors[0];
  return typeof first === "string" ? first : String(first);
}
