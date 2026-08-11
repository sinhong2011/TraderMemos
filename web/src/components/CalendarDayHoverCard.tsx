import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { DayDetail, DayRecord } from "@/lib/calendar";
import type { Trade } from "@/lib/api/types";
import { CalendarDayHoverDetails } from "./CalendarDayHoverDetails";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./HoverCard";

/** Shared day preview — same HoverCard + details stack as calendar year view. */
export function CalendarDayHoverCard({
  date,
  pnl,
  record,
  currency,
  fxRate = 1,
  trades,
  detail,
  onOpenDayReview,
  children,
  className,
  style,
  ariaLabel,
  ariaCurrent,
  delay = 120,
  closeDelay = 80,
  sideOffset = 6,
  render,
}: {
  date: string;
  pnl: number;
  record?: DayRecord;
  currency: string;
  fxRate?: number;
  trades?: Trade[];
  /** At-a-glance stats (balances, deposits, fees, PF…) for the richer card. */
  detail?: DayDetail;
  onOpenDayReview?: (day: string) => void;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  ariaCurrent?: "date";
  delay?: number;
  closeDelay?: number;
  sideOffset?: number;
  render?: ReactElement;
}) {
  const hasRows = (trades?.length ?? 0) > 0;
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={delay}
        closeDelay={closeDelay}
        render={render ?? <div />}
        aria-label={ariaLabel ?? date}
        aria-current={ariaCurrent}
        className={className}
        style={style}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={sideOffset}
        className={hasRows ? "max-w-[22rem] p-3" : undefined}
      >
        <CalendarDayHoverDetails
          date={date}
          pnl={pnl}
          record={record}
          currency={currency}
          fxRate={fxRate}
          trades={trades}
          detail={detail}
          onOpenDayReview={onOpenDayReview}
        />
      </HoverCardContent>
    </HoverCard>
  );
}
