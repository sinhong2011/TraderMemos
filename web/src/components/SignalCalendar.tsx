import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import type { ComponentProps } from "react";
import { type DateRange, DayPicker } from "react-day-picker";
import { cn } from "../lib/cn";
import { intlLocale } from "../lib/locale";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";

export type { DateRange };

export const signalCalendarClassNames: NonNullable<ComponentProps<typeof DayPicker>["classNames"]> =
  {
    months: "relative flex flex-col",
    month: "w-[252px]",
    month_caption: "mb-3 flex h-8 items-center justify-center",
    caption_label:
      "flex items-center gap-1 text-[12px] font-medium tracking-normal text-foreground capitalize",
    dropdowns: "flex items-center gap-1",
    // pointer-events-none so the full-width strip doesn't swallow clicks
    // aimed at the caption dropdowns underneath; buttons re-enable it.
    nav: "pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between",
    button_previous: cn(
      "pointer-events-auto flex size-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground",
      "transition-colors hover:bg-accent hover:text-foreground",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    ),
    button_next: cn(
      "pointer-events-auto flex size-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground",
      "transition-colors hover:bg-accent hover:text-foreground",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    ),
    month_grid: "w-full border-collapse",
    weekdays: "flex",
    weekday:
      "flex-1 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground",
    week: "mt-1 flex w-full",
    day: "relative flex-1 p-0 text-center",
    day_button: cn(
      "mx-auto flex size-8 cursor-pointer items-center justify-center rounded-md text-[11px] tabular-nums text-foreground",
      "pointer-coarse:size-10 pointer-coarse:text-[13px]",
      "transition-[background-color,color,box-shadow] duration-100 hover:bg-accent",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    ),
    selected:
      "[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-background [&>button]:hover:bg-primary [&>button]:hover:text-background",
    range_start:
      "rounded-l-control bg-primary/10 [&>button]:rounded-r-none [&>button]:bg-primary [&>button]:font-semibold [&>button]:text-background",
    range_end:
      "rounded-r-control bg-primary/10 [&>button]:rounded-l-none [&>button]:bg-primary [&>button]:font-semibold [&>button]:text-background",
    range_middle:
      "bg-primary/10 [&>button]:rounded-none [&>button]:bg-transparent [&>button]:font-normal [&>button]:text-foreground [&>button]:hover:bg-primary/10",
    today: "[&>button]:ring-1 [&>button]:ring-signal/50 [&>button]:ring-inset",
    outside: "[&>button]:text-muted-foreground [&>button]:opacity-40",
    disabled: "[&>button]:cursor-not-allowed [&>button]:opacity-30",
    hidden: "invisible",
  };

/**
 * Month/year caption dropdown — a real native <select>, styled to match
 * shadcn. Native beats a custom popover-in-popover here: on touch
 * devices it opens the OS's own scrollable picker instead of a cramped
 * nested list.
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
    <NativeSelect
      size="sm"
      variant="ghost"
      value={String(value)}
      onChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className="font-medium capitalize"
    >
      {(options ?? []).map((o) => (
        <NativeSelectOption key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

/** shadcn-style calendar adapted to shadcn tokens. */
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
