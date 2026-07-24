import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import { Button } from "./ui/button";

type AttachmentState = "idle" | "uploading" | "processing" | "error" | "done";
type AttachmentSize = "default" | "sm" | "xs";
type AttachmentOrientation = "horizontal" | "vertical";

const attachmentSizeClass: Record<AttachmentSize, string> = {
  default:
    "gap-2 text-sm has-data-[slot=attachment-content]:px-2.5 has-data-[slot=attachment-content]:py-2 has-data-[slot=attachment-media]:p-2",
  sm: "gap-2.5 text-xs has-data-[slot=attachment-content]:px-2 has-data-[slot=attachment-content]:py-1.5 has-data-[slot=attachment-media]:p-1.5",
  xs: "gap-1.5 rounded-md text-xs has-data-[slot=attachment-content]:px-1.5 has-data-[slot=attachment-content]:py-1 has-data-[slot=attachment-media]:p-1",
};

const attachmentOrientationClass: Record<AttachmentOrientation, string> = {
  horizontal: "min-w-40 items-center",
  vertical: "w-24 flex-col has-data-[slot=attachment-content]:w-30",
};

function Attachment({
  className,
  state = "done",
  size = "default",
  orientation = "horizontal",
  ...props
}: ComponentProps<"div"> & {
  state?: AttachmentState;
  size?: AttachmentSize;
  orientation?: AttachmentOrientation;
}) {
  return (
    <div
      data-slot="attachment"
      data-state={state}
      data-size={size}
      data-orientation={orientation}
      className={cn(
        "group/attachment relative flex w-fit max-w-full min-w-0 shrink-0 flex-wrap rounded-lg border border-border bg-card text-foreground transition-colors",
        "focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-ring",
        "has-[>a,>button]:hover:bg-accent data-[state=error]:border-destructive/30 data-[state=idle]:border-dashed",
        attachmentSizeClass[size],
        attachmentOrientationClass[orientation],
        className,
      )}
      {...props}
    />
  );
}

type AttachmentMediaVariant = "icon" | "image";

function AttachmentMedia({
  className,
  variant = "icon",
  ...props
}: ComponentProps<"div"> & { variant?: AttachmentMediaVariant }) {
  return (
    <div
      data-slot="attachment-media"
      data-variant={variant}
      className={cn(
        "relative flex aspect-square w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent text-foreground",
        "group-data-[orientation=vertical]/attachment:w-full group-data-[size=sm]/attachment:w-8 group-data-[size=xs]/attachment:w-7",
        "group-data-[size=xs]/attachment:rounded-md group-data-[state=error]/attachment:bg-destructive/10 group-data-[state=error]/attachment:text-destructive",
        "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        "group-data-[orientation=vertical]/attachment:[&_svg:not([class*='size-'])]:size-6",
        "group-data-[size=xs]/attachment:[&_svg:not([class*='size-'])]:size-3.5",
        variant === "image" &&
          "opacity-60 group-data-[state=done]/attachment:opacity-100 group-data-[state=idle]/attachment:opacity-100 [&_img]:h-full [&_img]:w-full [&_img]:object-cover",
        className,
      )}
      {...props}
    />
  );
}

function AttachmentContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="attachment-content"
      className={cn(
        "max-w-full min-w-0 flex-1 leading-tight group-data-[orientation=vertical]/attachment:px-1",
        className,
      )}
      {...props}
    />
  );
}

function AttachmentTitle({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="attachment-title"
      className={cn(
        "block max-w-full min-w-0 truncate font-medium",
        "group-data-[state=processing]/attachment:animate-shimmer group-data-[state=uploading]/attachment:animate-shimmer",
        className,
      )}
      {...props}
    />
  );
}

function AttachmentDescription({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="attachment-description"
      className={cn(
        "mt-0.5 block min-w-full truncate text-xs text-muted-foreground group-data-[state=error]/attachment:text-destructive/80",
        className,
      )}
      {...props}
    />
  );
}

function AttachmentActions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="attachment-actions"
      className={cn(
        "relative z-20 flex shrink-0 items-center",
        "group-data-[orientation=vertical]/attachment:absolute group-data-[orientation=vertical]/attachment:top-2 group-data-[orientation=vertical]/attachment:right-2",
        className,
      )}
      {...props}
    />
  );
}

function AttachmentAction({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      data-slot="attachment-action"
      className={className}
      {...props}
    />
  );
}

function AttachmentTrigger({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      data-slot="attachment-trigger"
      className={cn(
        "absolute inset-0 z-10 h-auto rounded-none border-none bg-transparent p-0 hover:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

function AttachmentGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="attachment-group"
      role="group"
      tabIndex={0}
      aria-label="Screenshot attachments"
      className={cn(
        "flex min-w-0 snap-x snap-mandatory scroll-px-1 gap-3 overflow-x-auto overscroll-x-contain py-1",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "*:data-[slot=attachment]:flex-none *:data-[slot=attachment]:snap-start",
        className,
      )}
      {...props}
    />
  );
}

export {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
};
