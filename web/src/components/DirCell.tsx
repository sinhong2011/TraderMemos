import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { resolveTradeDirection, type TradeDirectionView } from "@/lib/tradeDirection";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

/** Shared by the Dir column and the list row so both color a side the same way. */
export const DIR_TONE_CLASS: Record<TradeDirectionView["tone"], string> = {
  profit: "text-profit",
  loss: "text-destructive",
  signal: "text-chart-3",
  muted: "text-muted-foreground",
};

export function DirCell(props: {
  direction: string;
  instrumentType?: string;
  optionRight?: string | null;
  symbol?: string;
  markMissingOptionRight?: boolean;
  className?: string;
}) {
  const view = resolveTradeDirection(props);
  const Icon = view.arrowUp ? ArrowUpRight : ArrowDownRight;
  const color = DIR_TONE_CLASS[view.tone];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "inline-flex cursor-default items-center gap-1 outline-none",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              props.className,
            )}
          />
        }
      >
        <Icon size={14} strokeWidth={2} className={color} aria-hidden />
        {view.tag ? (
          <span className={cn("text-[11px] font-semibold tracking-wide", color)}>{view.tag}</span>
        ) : null}
        <span className="sr-only">{view.label}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex-col items-start gap-0.5 px-2.5 py-1.5">
        <span className="font-medium text-foreground">{view.label}</span>
        <span className="text-[10px] text-muted-foreground">{view.detail}</span>
      </TooltipContent>
    </Tooltip>
  );
}
