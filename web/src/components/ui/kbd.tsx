import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * shadcn Kbd — shadcn Base kbd with theme tokens.
 * @see https://ui.shadcn.com/docs/components/base/kbd
 */
const kbdVariants = cva(
  [
    "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1",
    "rounded-md border-none px-1.5 font-sans text-[10px] leading-none font-medium select-none",
    "[&_svg:not([class*='size-'])]:size-3",
  ].join(" "),
  {
    variants: {
      variant: {
        /** Quiet keycap for chrome, lists, and shortcuts. */
        muted: "min-w-[1.25rem] bg-muted tabular-nums text-muted-foreground",
        /** Emphasized keycap for discovery / shortcut hints. */
        accent: "bg-warning/10 text-warning",
        /** @deprecated Use `accent` — Signal Terminal leftover. */
        signal: "bg-warning/10 text-warning",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  },
);

function Kbd({
  className,
  variant = "muted",
  ...props
}: ComponentProps<"kbd"> & VariantProps<typeof kbdVariants>) {
  return <kbd data-slot="kbd" className={cn(kbdVariants({ variant }), className)} {...props} />;
}

function KbdGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup, kbdVariants };
