import { CalendarDays, ChevronDown, Clock } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { isoToWallClock } from "@/lib/displayPrefs";
import { fieldControlTriggerClass, fieldInputClass } from "./field-styles";
import { AppCalendar } from "./AppCalendar";
import { ControlledPopover } from "./ControlledPopover";
import { Button } from "./ui/button";
import { NativeSelectOption } from "./ui/native-select";

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
  return isoToWallClock(new Date());
}

/** Closed-trigger label — `yyyy-MM-dd HH:mm:ss` (wall-clock from datetime-local). */
function formatDisplay(value: string): string | null {
  const parsed = parseDatetimeLocal(value);
  if (!parsed) return null;
  const { date, hours, minutes, seconds } = parsed;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

type TimeParts = { hours: number; minutes: number; seconds: number };

const TIME_PARTS = [
  { key: "hours", label: "Hours", max: 23 },
  { key: "minutes", label: "Minutes", max: 59 },
  { key: "seconds", label: "Seconds", max: 59 },
] as const;

/**
 * One `hh` / `mm` / `ss` slot — a native <select> laid over its own label, the
 * same pattern as the calendar caption. Touch gets the OS wheel, keyboard gets
 * the browser's digit type-ahead ("1", "4" → 14), and nothing can be typed out
 * of range. The label stays in flow so the slot is exactly two digits wide.
 */
function TimeSegment({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const options = useMemo(() => Array.from({ length: max + 1 }, (_, n) => pad(n)), [max]);

  return (
    <span
      className={cn(
        "relative inline-flex h-6 w-7 items-center justify-center rounded-sm text-[13px] text-foreground",
        // The focused slot highlights whole, like a native time field.
        "transition-colors hover:bg-accent has-focus:bg-primary has-focus:text-primary-foreground",
        "pointer-coarse:w-8 pointer-coarse:text-base",
      )}
    >
      <span aria-hidden>{pad(value)}</span>
      <select
        aria-label={label}
        value={pad(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        // ≥16px so iOS Safari doesn't zoom the page when the picker opens.
        className="absolute inset-0 cursor-pointer appearance-none bg-transparent text-base opacity-0 outline-none"
      >
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option}
          </NativeSelectOption>
        ))}
      </select>
    </span>
  );
}

/**
 * `hh:mm:ss` field. Replaces three scrolling columns: one row instead of
 * ~200px of lists, with each slot its own native picker.
 */
function TimeField({ value, onChange }: { value: TimeParts; onChange: (next: TimeParts) => void }) {
  return (
    <div
      role="group"
      aria-label="Time"
      className={cn(
        fieldInputClass,
        "w-auto flex-1 justify-center gap-1.5 px-2.5 tabular-nums",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/24",
      )}
    >
      <Clock size={13} strokeWidth={1.5} className="shrink-0 text-muted-foreground" aria-hidden />
      {TIME_PARTS.map(({ key, label, max }, index) => (
        <Fragment key={key}>
          {index > 0 && (
            <span className="-mx-1 text-muted-foreground/60" aria-hidden>
              :
            </span>
          )}
          <TimeSegment
            label={label}
            max={max}
            value={value[key]}
            onChange={(n) => onChange({ ...value, [key]: n })}
          />
        </Fragment>
      ))}
    </div>
  );
}

/**
 * Datetime picker — calendar + `hh:mm:ss` field.
 * Value uses datetime-local shape: `YYYY-MM-DDTHH:mm:ss`.
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  compact = false,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  /** Dense label for fill rows — matches `AmountInput`'s compact type scale. */
  compact?: boolean;
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
    // "Now" on the display clock, so the draft matches what apply() stores.
    const parsed = parseDatetimeLocal(nowDatetimeLocal());
    if (!parsed) return;
    setDraftDate(parsed.date);
    setDraftHours(parsed.hours);
    setDraftMinutes(parsed.minutes);
    setDraftSeconds(parsed.seconds);
    setMonth(parsed.date);
  };

  return (
    <ControlledPopover
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
        "inline-flex w-full cursor-pointer items-center gap-2",
        fieldControlTriggerClass,
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
              "min-w-0 flex-1 truncate text-left tabular-nums",
              compact ? "text-[12px]" : "text-[13px]",
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
      {/* Single column at every width: the calendar sets the panel's width and
          the time row is short enough to sit under it even on a phone. */}
      <div className="flex w-full flex-col gap-3">
        <AppCalendar
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
          className="w-full p-0"
        />
        <div className="flex items-center gap-2">
          <TimeField
            value={{ hours: draftHours, minutes: draftMinutes, seconds: draftSeconds }}
            onChange={(next) => {
              setDraftHours(next.hours);
              setDraftMinutes(next.minutes);
              setDraftSeconds(next.seconds);
            }}
          />
          <Button type="button" variant="soft" size="sm" onClick={setNow}>
            Now
          </Button>
        </div>
        {/* Below sm the actions become a full-width block row — pill-sized
            buttons in a corner are a poor thumb target on a phone. */}
        <div className="flex items-center justify-end gap-2 max-sm:gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-sm:h-8 max-sm:flex-1 max-sm:text-[13px]"
            onClick={() => {
              setOpen(false);
              onBlur?.();
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="max-sm:h-8 max-sm:flex-1 max-sm:text-[13px]"
            onClick={apply}
          >
            Apply
          </Button>
        </div>
      </div>
    </ControlledPopover>
  );
}
