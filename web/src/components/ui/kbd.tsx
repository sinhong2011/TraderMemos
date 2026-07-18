import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

/**
 * Signal Terminal Kbd — shadcn Base kbd with product tokens.
 * @see https://ui.shadcn.com/docs/components/base/kbd
 */
const kbdVariants = cva(
  [
    "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1",
    "rounded-control border-none px-1.5 font-ui text-[10px] leading-none font-medium select-none",
    "[&_svg:not([class*='size-'])]:size-3",
  ].join(" "),
  {
    variants: {
      variant: {
        /** Signal yellow wayfinding (esc, ⌘K, primary discovery). */
        signal: "bg-[rgba(228,255,26,0.06)] text-signal",
        /** Quiet keycap for dense lists (nav chords). */
        muted: "min-w-[1.25rem] bg-bg-input tabular-nums text-text-muted",
      },
    },
    defaultVariants: {
      variant: "signal",
    },
  },
);

function Kbd({
  className,
  variant = "signal",
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
