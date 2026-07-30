"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/cn";

/**
 * Button group — joined controls with coss field chrome.
 * @see https://coss.com/ui/docs/styling
 */

const buttonGroupVariants = cva(
  [
    "flex w-fit items-stretch",
    "*:focus-visible:relative *:focus-visible:z-10",
    "has-[>[data-slot=button-group]]:gap-2",
    "has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-lg",
    "[&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit",
    "[&>input]:flex-1",
  ].join(" "),
  {
    variants: {
      orientation: {
        horizontal:
          "*:data-slot:rounded-r-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-lg! [&>[data-slot]~[data-slot]]:rounded-l-none [&>[data-slot]~[data-slot]]:border-l-0",
        vertical:
          "flex-col *:data-slot:rounded-b-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-lg! [&>[data-slot]~[data-slot]]:rounded-t-none [&>[data-slot]~[data-slot]]:border-t-0",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  },
);

function ButtonGroup({
  className,
  orientation,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  );
}

function ButtonGroupText({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "relative inline-flex items-center gap-2 rounded-lg border border-input bg-background px-[calc(--spacing(2.5)-1px)] not-dark:bg-clip-padding text-sm font-medium text-foreground shadow-xs/5",
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)]",
          "not-disabled:before:shadow-[0_1px_--theme(--color-black/4%)]",
          "dark:bg-input/32 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
          "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: "button-group-text",
    },
  });
}

function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn(
        "relative self-stretch bg-input data-horizontal:mx-px data-horizontal:w-auto data-vertical:my-px data-vertical:h-auto",
        className,
      )}
      {...props}
    />
  );
}

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroupVariants };
