import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/**
 * Signal Terminal Button — shadcn Base UI button with product tokens.
 * @see https://ui.shadcn.com/docs/components/base/button
 */
const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5",
    "rounded-control border border-transparent bg-clip-padding",
    "text-[12px] font-medium whitespace-nowrap select-none",
    "transition-[color,background-color,opacity,border-color,box-shadow] duration-150 ease-[var(--ease-out)]",
    "outline-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    "aria-invalid:border-loss aria-invalid:outline-loss/40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-accent text-bg hover:opacity-90",
        outline:
          "border-border bg-bg-inset text-text-muted hover:border-border-strong hover:bg-bg-hover hover:text-text aria-expanded:bg-bg-hover aria-expanded:text-text",
        secondary:
          "bg-bg-input text-text-muted hover:bg-bg-input-hover hover:text-text aria-expanded:bg-bg-input-hover aria-expanded:text-text",
        ghost:
          "text-text-muted hover:bg-bg-hover hover:text-text aria-expanded:bg-bg-hover aria-expanded:text-text",
        soft: "bg-accent-bg text-accent hover:bg-accent-bg/80 hover:text-text",
        destructive:
          "border-loss/40 bg-transparent text-loss hover:bg-loss/10 focus-visible:outline-loss",
        link: "h-auto rounded-none px-0 text-accent underline-offset-4 hover:underline",
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

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
