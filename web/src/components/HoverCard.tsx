import { PreviewCard } from "@base-ui/react/preview-card";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";
import { signalOverlayPopupClass } from "./signal-overlay-styles";

/** shadcn-style HoverCard built on Base UI PreviewCard (project stack). */
export function HoverCard(props: ComponentProps<typeof PreviewCard.Root>) {
  return <PreviewCard.Root {...props} />;
}

export function HoverCardTrigger({
  className,
  delay = 200,
  closeDelay = 100,
  ...props
}: ComponentProps<typeof PreviewCard.Trigger>) {
  return (
    <PreviewCard.Trigger
      delay={delay}
      closeDelay={closeDelay}
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export function HoverCardContent({
  className,
  side = "top",
  align = "center",
  sideOffset = 8,
  children,
}: {
  className?: string;
  side?: ComponentProps<typeof PreviewCard.Positioner>["side"];
  align?: ComponentProps<typeof PreviewCard.Positioner>["align"];
  sideOffset?: number;
  children: ReactNode;
}) {
  return (
    <PreviewCard.Portal>
      <PreviewCard.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        positionMethod="fixed"
        className="z-[400]"
      >
        <PreviewCard.Popup
          className={cn(signalOverlayPopupClass, "w-max max-w-[264px] p-3.5", className)}
        >
          {children}
        </PreviewCard.Popup>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  );
}
