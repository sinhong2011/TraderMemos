import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

/**
 * Signal Terminal Native Select — shadcn Base native-select adapted to
 * product tokens. Real <select> beats a custom popover for short, frequent
 * choices (year, month): on touch it opens the OS's own picker instead of a
 * cramped nested list.
 * @see https://ui.shadcn.com/docs/components/base/native-select
 */
function NativeSelect({
  className,
  wrapperClassName,
  size = "default",
  variant = "default",
  ...props
}: Omit<ComponentProps<"select">, "size"> & {
  size?: "sm" | "default";
  variant?: "default" | "ghost";
  /** Applied to the outer wrapper (default `w-fit`). Use `w-full` for settings rows. */
  wrapperClassName?: string;
}) {
  return (
    <span
      data-slot="native-select-wrapper"
      className={cn(
        "group/native-select relative inline-flex items-center has-[select:disabled]:opacity-55",
        wrapperClassName ?? "w-fit",
      )}
    >
      <select
        data-slot="native-select"
        className={cn(
          "w-full min-w-0 cursor-pointer appearance-none rounded-control border border-border text-text",
          "outline-none transition-[background-color,color] duration-150",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong",
          "disabled:pointer-events-none disabled:cursor-not-allowed",
          // ≥16px on coarse pointers so iOS Safari doesn't zoom the page on focus
          size === "default" && "h-10 py-0 pr-8 pl-3 text-[13px] pointer-coarse:text-base",
          size === "sm" &&
            "h-7 py-0 pr-6 pl-2.5 text-[12px] pointer-coarse:h-9 pointer-coarse:text-base",
          variant === "default" && "bg-bg-input hover:bg-bg-input-hover",
          variant === "ghost" && "bg-transparent hover:bg-bg-hover",
          className,
        )}
        {...props}
      />
      <ChevronDown
        size={12}
        strokeWidth={1.5}
        className={cn(
          "pointer-events-none absolute text-text-dim",
          size === "default" ? "right-3" : "right-2",
        )}
        aria-hidden
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

export { NativeSelect, NativeSelectOption };
