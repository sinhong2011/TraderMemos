import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import type { ComponentProps } from "react";
import { type DateRange, DayPicker } from "react-day-picker";
import { cn } from "../lib/cn";
import { intlLocale } from "../lib/locale";
import { SignalSelect } from "./SignalSelect";

export type { DateRange };

export const signalCalendarClassNames: NonNullable<ComponentProps<typeof DayPicker>["classNames"]> =
  {
    months: "relative flex flex-col",
    month: "w-[252px]",
    month_caption: "mb-3 flex h-8 items-center justify-center",
    caption_label:
      "flex items-center gap-1 text-[12px] font-medium tracking-normal text-text capitalize",
    dropdowns: "flex items-center gap-1",
    // pointer-events-none so the full-width strip doesn't swallow clicks
    // aimed at the caption dropdowns underneath; buttons re-enable it.
    nav: "pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between",
    button_previous: cn(
      "pointer-events-auto flex size-7 cursor-pointer items-center justify-center rounded-control border border-border bg-bg-inset text-text-muted",
      "transition-colors hover:border-border-strong hover:bg-bg-hover hover:text-text",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    ),
    button_next: cn(
      "pointer-events-auto flex size-7 cursor-pointer items-center justify-center rounded-control border border-border bg-bg-inset text-text-muted",
      "transition-colors hover:border-border-strong hover:bg-bg-hover hover:text-text",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    ),
    month_grid: "w-full border-collapse",
    weekdays: "flex",
    weekday: "flex-1 text-center text-[10px] font-medium uppercase tracking-widest text-text-dim",
    week: "mt-1 flex w-full",
    day: "relative flex-1 p-0 text-center",
    day_button: cn(
      "mx-auto flex size-8 cursor-pointer items-center justify-center rounded-control text-[11px] tabular-nums text-text",
      "transition-[background-color,color,box-shadow] duration-100 hover:bg-bg-hover",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
    ),
    selected:
      "[&>button]:bg-accent [&>button]:font-semibold [&>button]:text-bg [&>button]:hover:bg-accent [&>button]:hover:text-bg",
    range_start:
      "rounded-l-control bg-accent-bg [&>button]:rounded-r-none [&>button]:bg-accent [&>button]:font-semibold [&>button]:text-bg",
    range_end:
      "rounded-r-control bg-accent-bg [&>button]:rounded-l-none [&>button]:bg-accent [&>button]:font-semibold [&>button]:text-bg",
    range_middle:
      "bg-accent-bg [&>button]:rounded-none [&>button]:bg-transparent [&>button]:font-normal [&>button]:text-text [&>button]:hover:bg-accent/10",
    today: "[&>button]:ring-1 [&>button]:ring-signal/50 [&>button]:ring-inset",
    outside: "[&>button]:text-text-dim [&>button]:opacity-40",
    disabled: "[&>button]:cursor-not-allowed [&>button]:opacity-30",
    hidden: "invisible",
  };

/**
 * Month/year caption dropdown rendered as a SignalSelect instead of the
 * native <select> react-day-picker ships. rdp's handlers only read
 * `e.target.value`, so a synthetic change event is enough.
 */
function SignalCalendarDropdown({
  options,
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  options?: { value: number; label: string; disabled: boolean }[];
  value?: string | number | readonly string[];
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <SignalSelect
      value={String(value)}
      ariaLabel={ariaLabel}
      disabled={disabled}
      options={(options ?? []).map((o) => ({
        value: String(o.value),
        label: o.label,
        disabled: o.disabled,
      }))}
      onValueChange={(v) =>
        onChange?.({
          target: { value: v },
        } as React.ChangeEvent<HTMLSelectElement>)
      }
      ghost
      className="w-auto"
      triggerClassName="h-7 w-auto gap-1.5 px-2 text-[12px] font-medium capitalize"
    />
  );
}

/** shadcn-style calendar adapted to Signal Terminal tokens. */
export function SignalCalendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("signal-calendar", className)}
      classNames={{
        ...signalCalendarClassNames,
        ...classNames,
      }}
      formatters={{
        formatCaption: (date) =>
          date.toLocaleDateString(intlLocale(), {
            month: "long",
            year: "numeric",
          }),
        ...props.formatters,
      }}
      components={{
        Chevron: ({ orientation, className }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeft
              : orientation === "right"
                ? ChevronRight
                : orientation === "up"
                  ? ChevronUp
                  : ChevronDown;
          const size = orientation === "down" || orientation === "up" ? 12 : 14;
          return <Icon size={size} strokeWidth={1.75} className={className} aria-hidden />;
        },
        Dropdown: SignalCalendarDropdown,
        ...props.components,
      }}
      {...props}
    />
  );
}
