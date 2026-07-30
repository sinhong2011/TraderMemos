import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ToneToggleVariant = "default" | "outline";
export type ToneToggleSize = "sm" | "default" | "lg";
/** Pressed-state color: accent (setups/tags/session), neg (mistakes). */
export type ToneToggleTone = "accent" | "neg";

const sizeClass: Record<ToneToggleSize, string> = {
  sm: "h-7 min-w-7 px-2.5 text-[11px]",
  default: "h-8 min-w-8 px-2.5 text-[12px]",
  lg: "h-9 min-w-9 px-3 text-[13px]",
};

const variantClass: Record<ToneToggleVariant, string> = {
  default: "border-transparent bg-accent",
  outline: "border border-border bg-transparent",
};

const tonePressedClass: Record<ToneToggleTone, string> = {
  accent: "aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-primary",
  neg: "aria-pressed:border-destructive/40 aria-pressed:bg-destructive/10 aria-pressed:text-destructive",
};

/**
 * Shadcn/Base UI Toggle adapted to shadcn tokens.
 * @see https://ui.shadcn.com/docs/components/base/toggle
 */
export function ToneToggle({
  className,
  variant = "default",
  size = "sm",
  tone = "accent",
  ...props
}: ComponentProps<typeof TogglePrimitive> & {
  variant?: ToneToggleVariant;
  size?: ToneToggleSize;
  tone?: ToneToggleTone;
}) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(
        "group/toggle inline-flex cursor-pointer items-center justify-center gap-1 rounded-md",
        "border font-semibold tracking-[0.02em] whitespace-nowrap text-muted-foreground outline-none",
        "transition-colors duration-150",
        "hover:bg-accent hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
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
