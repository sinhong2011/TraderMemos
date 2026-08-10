import { X } from "lucide-react";
import { useRef } from "react";
import { CalendarWeekHoverDetails } from "@/components/CalendarWeekHoverDetails";
import { WinLossRecord } from "@/components/WinLossRecord";
import type { DayRecord, WeekDetail, WeekSummary } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { fmtSignedMoney } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "./Drawer";
import { pnlColor } from "./theme-tokens";
import { Button } from "./ui/button";

function formatWeekRangeTitle(firstDate: string, lastDate: string): string {
  const locale = intlLocale();
  const start = new Date(`${firstDate}T12:00:00Z`);
  const end = new Date(`${lastDate}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).formatRange(start, end);
}

function formatWeekDrawerTitle(weekSummary: WeekSummary): string {
  const range =
    weekSummary.firstDate && weekSummary.lastDate
      ? formatWeekRangeTitle(weekSummary.firstDate, weekSummary.lastDate)
      : "Week";
  if (weekSummary.weekNumber != null) {
    return `Week review — Week ${weekSummary.weekNumber} — ${range}`;
  }
  return `Week review — ${range}`;
}

function dayTradeCount(rec: DayRecord | undefined): number {
  if (!rec) return 0;
  return rec.wins + rec.losses;
}

export interface WeekReviewDrawerProps {
  weekReviewIndex: number | null;
  onClose: () => void;
  week: ({ date: string; pnl: number | null } | null)[];
  weekSummary: WeekSummary;
  detail?: WeekDetail;
  records: Record<string, DayRecord>;
  currency: string;
  fxRate?: number;
  onSelectDay: (day: string) => void;
}

export function WeekReviewDrawer({
  weekReviewIndex,
  onClose,
  week,
  weekSummary,
  detail,
  records,
  currency,
  fxRate = 1,
  onSelectDay,
}: WeekReviewDrawerProps) {
  const open = weekReviewIndex != null;
  const snapshotRef = useRef({ week, weekSummary, detail });
  if (open) {
    snapshotRef.current = { week, weekSummary, detail };
  }
  const {
    week: displayWeek,
    weekSummary: displaySummary,
    detail: displayDetail,
  } = snapshotRef.current;
  const title = formatWeekDrawerTitle(displaySummary);
  const days = displayWeek.filter((c): c is { date: string; pnl: number | null } => c != null);

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      modal="trap-focus"
    >
      <DrawerContent className="[--drawer-content-width:min(440px,calc(100vw-2*var(--drawer-inset)))]">
        <DrawerHeader className="px-4 py-3">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerClose
            aria-label="Close"
            className="ml-auto flex cursor-pointer rounded-md border-none bg-transparent p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={18} strokeWidth={1.5} />
          </DrawerClose>
        </DrawerHeader>
        <DrawerBody className="gap-0 p-0">
          <div className="px-4 pb-4">
            <CalendarWeekHoverDetails
              firstDate={displaySummary.firstDate}
              lastDate={displaySummary.lastDate}
              weekNumber={displaySummary.weekNumber}
              pnl={displaySummary.pnl}
              hasData={displaySummary.hasData}
              currency={currency}
              fxRate={fxRate}
              detail={displayDetail}
            />
          </div>
          {days.length > 0 ? (
            <ul className="m-0 flex flex-col gap-0.5 px-2 pb-4">
              {days.map((cell) => {
                const rec = records[cell.date];
                const trades = dayTradeCount(rec);
                const hasPnl = cell.pnl != null;
                return (
                  <li key={cell.date}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-between rounded-md px-3 py-2 text-left"
                      onClick={() => onSelectDay(cell.date)}
                    >
                      <span className="text-[13px] text-foreground">
                        {new Date(`${cell.date}T12:00:00Z`).toLocaleDateString(intlLocale(), {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                      </span>
                      <span className="flex items-center gap-2 text-[12px] tabular-nums">
                        {hasPnl ? (
                          <span className={cn("font-semibold", pnlColor(cell.pnl!))}>
                            {fmtSignedMoney(cell.pnl! * fxRate, currency, intlLocale())}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No trades</span>
                        )}
                        {trades > 0 ? (
                          <>
                            <span className="text-muted-foreground">
                              {trades} {trades === 1 ? "trade" : "trades"}
                            </span>
                            {rec ? <WinLossRecord wins={rec.wins} losses={rec.losses} /> : null}
                          </>
                        ) : null}
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
