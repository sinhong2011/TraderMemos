import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export type SignalToggleVariant = "default" | "outline";
export type SignalToggleSize = "sm" | "default" | "lg";
/** Pressed-state color: accent (setups/tags/session), neg (mistakes). */
export type SignalToggleTone = "accent" | "neg";

const sizeClass: Record<SignalToggleSize, string> = {
  sm: "h-7 min-w-7 px-2.5 text-[11px]",
  default: "h-8 min-w-8 px-2.5 text-[12px]",
  lg: "h-9 min-w-9 px-3 text-[13px]",
};

const variantClass: Record<SignalToggleVariant, string> = {
  default: "border-transparent bg-bg-hover",
  outline: "border border-border bg-transparent",
};

const tonePressedClass: Record<SignalToggleTone, string> = {
  accent: "aria-pressed:border-accent/40 aria-pressed:bg-accent-bg aria-pressed:text-accent",
  neg: "aria-pressed:border-loss/40 aria-pressed:bg-tint-neg aria-pressed:text-loss",
};

/**
 * Shadcn/Base UI Toggle adapted to Signal Terminal tokens.
 * @see https://ui.shadcn.com/docs/components/base/toggle
 */
export function SignalToggle({
  className,
  variant = "default",
  size = "sm",
  tone = "accent",
  ...props
}: ComponentProps<typeof TogglePrimitive> & {
  variant?: SignalToggleVariant;
  size?: SignalToggleSize;
  tone?: SignalToggleTone;
}) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(
        "group/toggle inline-flex cursor-pointer items-center justify-center gap-1 rounded-control",
        "border font-semibold tracking-[0.02em] whitespace-nowrap text-text-muted outline-none",
        "transition-colors duration-150",
        "hover:bg-bg-input-hover hover:text-text",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        sizeClass[size],
        variantClass[variant],
        tonePressedClass[tone],
        className,
      )}
      {...props}
    />
  );
}
