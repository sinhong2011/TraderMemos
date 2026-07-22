import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

const itemVariantClass = {
  default: "border-transparent bg-transparent",
  outline: "border-border bg-transparent",
  muted: "border-transparent bg-bg-elevated",
} as const;

const itemSizeClass = {
  default: "gap-3 p-3.5",
  sm: "gap-2.5 px-3 py-2.5",
} as const;

const itemMediaVariantClass = {
  default: "bg-transparent",
  icon: "size-8 rounded-control bg-bg-hover text-text-muted [&_svg:not([class*='size-'])]:size-4",
  image: "size-10 overflow-hidden rounded-control [&_img]:size-full [&_img]:object-cover",
} as const;

export function ItemGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="list"
      data-slot="item-group"
      className={cn("group/item-group flex flex-col", className)}
      {...props}
    />
  );
}

export function Item({
  className,
  variant = "default",
  size = "default",
  ...props
}: ComponentProps<"div"> & {
  variant?: keyof typeof itemVariantClass;
  size?: keyof typeof itemSizeClass;
}) {
  return (
    <div
      role="listitem"
      data-slot="item"
      data-variant={variant}
      data-size={size}
      className={cn(
        "group/item flex flex-wrap items-center rounded-control border text-sm outline-none",
        "transition-colors duration-100",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
        itemVariantClass[variant],
        itemSizeClass[size],
        className,
      )}
      {...props}
    />
  );
}

export function ItemMedia({
  className,
  variant = "default",
  ...props
}: ComponentProps<"div"> & {
  variant?: keyof typeof itemMediaVariantClass;
}) {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(
        "flex shrink-0 items-center justify-center gap-2 self-start [&_svg]:pointer-events-none",
        "group-has-[[data-slot=item-description]]/item:mt-0.5",
        itemMediaVariantClass[variant],
        className,
      )}
      {...props}
    />
  );
}

export function ItemContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="item-content"
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-0.5 [&+[data-slot=item-content]]:flex-none",
        className,
      )}
      {...props}
    />
  );
}

export function ItemTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="item-title"
      className={cn(
        "flex w-fit max-w-full items-center gap-2 text-sm leading-snug font-medium",
        className,
      )}
      {...props}
    />
  );
}

export function ItemDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        "line-clamp-2 text-balance text-xs leading-normal font-normal text-text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function ItemActions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="item-actions"
      className={cn("flex shrink-0 items-center gap-1", className)}
      {...props}
    />
  );
}

export function ItemHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="item-header"
      className={cn("flex basis-full items-center justify-between gap-2", className)}
      {...props}
    />
  );
}

export function ItemFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="item-footer"
      className={cn("flex basis-full items-center justify-between gap-2", className)}
      {...props}
    />
  );
}
