import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { DayRecord } from "../lib/calendar";
import { CalendarDayHoverDetails } from "./CalendarDayHoverDetails";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./HoverCard";

/** Shared day preview — same HoverCard + details stack as calendar year view. */
export function CalendarDayHoverCard({
  date,
  pnl,
  record,
  currency,
  fxRate = 1,
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
      <HoverCardContent side="top" align="center" sideOffset={sideOffset}>
        <CalendarDayHoverDetails
          date={date}
          pnl={pnl}
          record={record}
          currency={currency}
          fxRate={fxRate}
        />
      </HoverCardContent>
    </HoverCard>
  );
}
