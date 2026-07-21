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
  size = "default",
  variant = "default",
  ...props
}: Omit<ComponentProps<"select">, "size"> & {
  size?: "sm" | "default";
  variant?: "default" | "ghost";
}) {
  return (
    <span
      data-slot="native-select-wrapper"
      className="group/native-select relative inline-flex w-fit items-center has-[select:disabled]:opacity-55"
    >
      <select
        data-slot="native-select"
        className={cn(
          "w-full min-w-0 cursor-pointer appearance-none rounded-control border border-transparent text-text",
          "outline-none transition-[background-color,color] duration-150",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          "disabled:pointer-events-none disabled:cursor-not-allowed",
          size === "default" && "h-10 py-0 pr-8 pl-3 text-[13px]",
          size === "sm" && "h-7 py-0 pr-6 pl-2.5 text-[12px]",
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
      className={cn("bg-bg-panel text-text", className)}
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOption };
