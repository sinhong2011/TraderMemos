"use client";

import { ChevronDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Native `<select>` with coss ui field chrome (same shell as Input / SelectTrigger).
 * Keeps the OS picker — better for short, frequent choices (year, month, rows).
 * @see https://coss.com/ui/docs/styling
 */

type NativeSelectProps = Omit<ComponentProps<"select">, "size"> & {
  size?: "sm" | "default" | "lg";
  /** Borderless control that blends into the surface until hovered. */
  variant?: "default" | "ghost";
  /** Applied to the outer wrapper (default `w-fit`). Use `w-full` for settings rows. */
  wrapperClassName?: string;
};

function NativeSelect({
  className,
  wrapperClassName,
  size = "default",
  variant = "default",
  ...props
}: NativeSelectProps) {
  return (
    <span
      data-slot="native-select-wrapper"
      data-size={size}
      data-variant={variant}
      className={cn(
        "group/native-select relative inline-flex items-center",
        variant === "default" &&
          cn(
            "rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow sm:text-sm",
            "before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)]",
            "not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)]",
            "has-focus-visible:border-ring has-focus-visible:ring-[3px]",
            "has-aria-invalid:border-destructive/36 has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16",
            "has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none",
            "dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            size === "default" && "h-8.5 sm:h-7.5",
            size === "sm" && "h-7.5 sm:h-6.5",
            size === "lg" && "h-9.5 sm:h-8.5",
          ),
        variant === "ghost" &&
          cn(
            "rounded-lg bg-transparent text-foreground transition-colors has-disabled:opacity-64 hover:bg-accent",
            size === "default" && "h-8.5 sm:h-7.5",
            size === "sm" && "h-7.5 sm:h-6.5",
            size === "lg" && "h-9.5 sm:h-8.5",
          ),
        wrapperClassName ?? "w-fit",
      )}
    >
      <select
        data-slot="native-select"
        data-size={size}
        className={cn(
          "h-full w-full min-w-0 cursor-pointer appearance-none bg-transparent text-foreground outline-none",
          "disabled:pointer-events-none disabled:cursor-not-allowed",
          // ≥16px on coarse pointers so iOS Safari doesn't zoom the page on focus
          "pointer-coarse:text-base",
          size === "default" && "py-0 pr-8 pl-[calc(--spacing(3)-1px)]",
          size === "sm" && "gap-1.5 py-0 pr-7 pl-[calc(--spacing(2.5)-1px)]",
          size === "lg" && "py-0 pr-9 pl-[calc(--spacing(3)-1px)]",
          className,
        )}
        {...props}
      />
      <ChevronDownIcon
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground opacity-80 select-none",
          "size-4.5 sm:size-4",
          size === "sm" ? "right-2" : "right-2.5",
        )}
        aria-hidden
        data-slot="native-select-icon"
      />
    </span>
  );
}

function NativeSelectOption({ className, ...props }: ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      // System colors so the OS picker stays readable (page `color` inherits as
      // near-white and washes out light native menus).
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  );
}

function NativeSelectOptGroup({ className, ...props }: ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
