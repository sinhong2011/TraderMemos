import { CalendarDays, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { signalControlTriggerClass } from "./signal-field-styles";
import { SignalCalendar } from "./SignalCalendar";
import { SignalPopover } from "./SignalPopover";
import { Button } from "./ui/button";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const SECONDS = Array.from({ length: 60 }, (_, i) => i);

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function calendarDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parse `YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss` into local Date parts. */
export function parseDatetimeLocal(value: string): {
  date: Date;
  hours: number;
  minutes: number;
  seconds: number;
} | null {
  if (!value?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hours = Number(m[4]);
  const minutes = Number(m[5]);
  const seconds = m[6] != null ? Number(m[6]) : 0;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return null;
  }
  return { date, hours, minutes, seconds };
}

export function formatDatetimeLocal(
  date: Date,
  hours: number,
  minutes: number,
  seconds: number,
): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function nowDatetimeLocal(): string {
  const d = new Date();
  return formatDatetimeLocal(d, d.getHours(), d.getMinutes(), d.getSeconds());
}

/** Closed-trigger label — `yyyy-MM-dd HH:mm:ss` (wall-clock from datetime-local). */
function formatDisplay(value: string): string | null {
  const parsed = parseDatetimeLocal(value);
  if (!parsed) return null;
  const { date, hours, minutes, seconds } = parsed;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function TimeColumn({
  values,
  selected,
  onSelect,
  ariaLabel,
}: {
  values: number[];
  selected: number;
  onSelect: (n: number) => void;
  ariaLabel: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-value="${selected}"]`);
    if (!el) return;
    root.scrollTop = el.offsetTop - root.clientHeight / 2 + el.clientHeight / 2;
  }, [selected]);

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={ariaLabel}
      className="h-[216px] w-12 overflow-y-auto rounded-md bg-muted py-1 [scrollbar-width:thin] sm:w-14"
    >
      {values.map((n) => {
        const active = n === selected;
        return (
          <Button
            key={n}
            type="button"
            variant={active ? "default" : "ghost"}
            role="option"
            data-value={n}
            aria-selected={active}
            onClick={() => onSelect(n)}
            className="h-8 w-full rounded-md tabular-nums"
          >
            {pad(n)}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Signal-styled datetime picker — calendar + hour/minute/second columns.
 * Value uses datetime-local shape: `YYYY-MM-DDTHH:mm:ss`.
 */
export function SignalDateTimePicker({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const fallback = parseDatetimeLocal(nowDatetimeLocal())!;
  const [draftDate, setDraftDate] = useState(fallback.date);
  const [draftHours, setDraftHours] = useState(fallback.hours);
  const [draftMinutes, setDraftMinutes] = useState(fallback.minutes);
  const [draftSeconds, setDraftSeconds] = useState(fallback.seconds);
  const [month, setMonth] = useState(fallback.date);

  const label = formatDisplay(value ?? "") ?? "Pick date & time";
  const hasValue = Boolean(parseDatetimeLocal(value ?? ""));
  const now = new Date();
  const minYear = Math.min(now.getFullYear() - 10, draftDate.getFullYear());
  const maxYear = Math.max(now.getFullYear() + 1, draftDate.getFullYear());

  const syncDraftFromValue = () => {
    const next = parseDatetimeLocal(value ?? "") ?? parseDatetimeLocal(nowDatetimeLocal())!;
    setDraftDate(next.date);
    setDraftHours(next.hours);
    setDraftMinutes(next.minutes);
    setDraftSeconds(next.seconds);
    setMonth(next.date);
  };

  const apply = () => {
    onChange(formatDatetimeLocal(draftDate, draftHours, draftMinutes, draftSeconds));
    setOpen(false);
    onBlur?.();
  };

  const setNow = () => {
    const d = new Date();
    const day = calendarDay(d);
    setDraftDate(day);
    setDraftHours(d.getHours());
    setDraftMinutes(d.getMinutes());
    setDraftSeconds(d.getSeconds());
    setMonth(day);
  };

  return (
    <SignalPopover
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        if (next) syncDraftFromValue();
        setOpen(next);
        if (!next) onBlur?.();
      }}
      triggerAriaLabel={ariaLabel}
      align="start"
      className="overflow-hidden p-0"
      triggerClassName={cn(
        "inline-flex cursor-pointer items-center gap-2",
        signalControlTriggerClass,
        disabled && "cursor-not-allowed opacity-55",
        open && "bg-accent",
        className,
      )}
      trigger={
        <>
          <CalendarDays
            size={13}
            strokeWidth={1.5}
            className="shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span
            id={id}
            className={cn(
              "min-w-0 flex-1 truncate text-left text-[13px] tabular-nums",
              hasValue ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </span>
          <ChevronDown
            size={12}
            strokeWidth={1.5}
            className={cn(
              "shrink-0 text-muted-foreground transition-transform duration-150",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </>
      }
    >
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
        <SignalCalendar
          mode="single"
          selected={draftDate}
          month={month}
          onMonthChange={setMonth}
          onSelect={(day) => {
            if (day) setDraftDate(calendarDay(day));
          }}
          captionLayout="dropdown"
          startMonth={new Date(minYear, 0)}
          endMonth={new Date(maxYear, 11)}
          className="p-0"
        />
        <div className="flex justify-center gap-1.5 sm:pt-1">
          <TimeColumn
            ariaLabel="Hours"
            values={HOURS}
            selected={draftHours}
            onSelect={setDraftHours}
          />
          <TimeColumn
            ariaLabel="Minutes"
            values={MINUTES}
            selected={draftMinutes}
            onSelect={setDraftMinutes}
          />
          <TimeColumn
            ariaLabel="Seconds"
            values={SECONDS}
            selected={draftSeconds}
            onSelect={setDraftSeconds}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 pb-3">
        <Button type="button" variant="soft" size="sm" onClick={setNow}>
          Now
        </Button>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              onBlur?.();
            }}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={apply}>
            Apply
          </Button>
        </div>
      </div>
    </SignalPopover>
  );
}
