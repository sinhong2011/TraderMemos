import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/** Neutral shadcn-style Tabs on Base UI. Product looks (pill track, etc.) live at call sites. */
export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn(className)} {...props} />;
}

export function TabsList({
  className,
  fullWidth = false,
  ...props
}: ComponentProps<typeof TabsPrimitive.List> & {
  fullWidth?: boolean;
}) {
  return (
    <TabsPrimitive.List
      className={cn(
        "relative m-0 inline-flex items-center gap-0.5",
        fullWidth && "flex w-full",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  fullWidth = false,
  ...props
}: ComponentProps<typeof TabsPrimitive.Tab> & {
  fullWidth?: boolean;
}) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "relative z-[1] inline-flex cursor-pointer items-center justify-center border-none bg-transparent",
        "rounded-control px-2.5 py-0.5 text-[11px] font-semibold",
        "text-text-muted transition-[color,transform] duration-150 ease-[var(--ease-out)]",
        "hover:text-text",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-border-strong",
        "active:scale-[0.98] motion-reduce:active:scale-100",
        "data-active:text-text",
        "data-disabled:pointer-events-none data-disabled:opacity-40",
        fullWidth && "min-w-0 flex-1",
        className,
      )}
      {...props}
    />
  );
}

/** Sliding indicator — Base UI sets `--active-tab-*`; style the fill at the call site. */
export function TabsIndicator({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Indicator>) {
  return (
    <TabsPrimitive.Indicator
      renderBeforeHydration
      className={cn(
        "pointer-events-none absolute z-0",
        "left-[var(--active-tab-left)] top-[var(--active-tab-top)]",
        "h-[var(--active-tab-height)] w-[var(--active-tab-width)]",
        "transition-[left,top,width,height] duration-250 ease-[var(--ease-out)]",
        "motion-reduce:transition-none",
        "data-[activation-direction=none]:transition-none",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      className={cn(
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong",
        className,
      )}
      {...props}
    />
  );
}
