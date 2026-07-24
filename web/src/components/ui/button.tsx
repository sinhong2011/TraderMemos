import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/**
 * Button — shadcn Base UI with theme tokens.
 * Icon sizes auto-wrap a tooltip from `aria-label` / `title` (opt out with `tooltip={false}`).
 * @see https://ui.shadcn.com/docs/components/base/button
 */
const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5",
    "rounded-md border border-transparent bg-clip-padding",
    "text-[12px] font-medium whitespace-nowrap select-none",
    "transition-[color,background-color,opacity,border-color,box-shadow] duration-150 ease-[cubic-bezier(0.16, 1, 0.3, 1)]",
    "outline-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    "aria-invalid:border-destructive aria-invalid:outline-destructive/40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border-border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        soft: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:outline-destructive",
        link: "h-auto rounded-none px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 px-2 text-[11px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-[11px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-1.5 px-5 text-[13px] font-semibold",
        icon: "size-8 p-0",
        "icon-xs": "size-6 p-0 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 p-0 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const ICON_SIZES = new Set(["icon", "icon-xs", "icon-sm", "icon-lg"]);

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /**
     * Tooltip label for icon buttons.
     * - omit / `true`: use `aria-label` or `title` when size is icon*
     * - `string`: custom tooltip text
     * - `false`: never show a tooltip
     */
    tooltip?: string | boolean;
  };

function resolveTooltip(
  size: ButtonProps["size"],
  tooltip: ButtonProps["tooltip"],
  ariaLabel: ButtonProps["aria-label"],
  title: ButtonProps["title"],
): string | undefined {
  if (tooltip === false) return undefined;
  if (typeof tooltip === "string") {
    const t = tooltip.trim();
    return t || undefined;
  }
  if (!ICON_SIZES.has(size ?? "")) return undefined;
  if (typeof ariaLabel === "string" && ariaLabel.trim()) return ariaLabel.trim();
  if (typeof title === "string" && title.trim()) return title.trim();
  return undefined;
}

function Button({
  className,
  variant = "default",
  size = "default",
  tooltip,
  title,
  "aria-label": ariaLabel,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const tip = resolveTooltip(size, tooltip, ariaLabel, title);
  const buttonClass = cn(buttonVariants({ variant, size }), className);

  if (!tip) {
    return (
      <ButtonPrimitive
        data-slot="button"
        className={buttonClass}
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        {...props}
      >
        {children}
      </ButtonPrimitive>
    );
  }

  // Drop native `title` when a custom tooltip is shown to avoid double tips.
  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <ButtonPrimitive
            data-slot="button"
            className={buttonClass}
            aria-label={ariaLabel}
            disabled={disabled}
            {...props}
          >
            {children}
          </ButtonPrimitive>
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ButtonPrimitive
            data-slot="button"
            className={buttonClass}
            aria-label={ariaLabel}
            disabled={disabled}
            {...props}
          />
        }
      >
        {children as ReactNode}
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
