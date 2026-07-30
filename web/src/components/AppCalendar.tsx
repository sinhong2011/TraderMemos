import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import type { ComponentProps } from "react";
import { type DateRange, DayPicker } from "react-day-picker";
import { cn } from "@/lib/cn";
import { intlLocale } from "@/lib/locale";
import { NativeSelectOption } from "./ui/native-select";

export type { DateRange };

export const appCalendarClassNames: NonNullable<ComponentProps<typeof DayPicker>["classNames"]> = {
  months: "relative flex w-full flex-col",
  // Fluid within its popover: touch targets get more room, but the grid
  // shrinks instead of overflowing when the panel is clamped to the viewport.
  month: "mx-auto w-[252px] max-w-full pointer-coarse:w-[284px]",
  month_caption: "mb-3 flex h-8 items-center justify-center",
  caption_label:
    "flex items-center gap-1 text-[12px] font-medium tracking-normal text-foreground capitalize",
  dropdowns: "flex items-center justify-center gap-1",
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
    "mx-auto flex aspect-square w-8 max-w-full cursor-pointer items-center justify-center rounded-md text-[11px] tabular-nums text-foreground",
    "pointer-coarse:w-10 pointer-coarse:text-[13px]",
    "transition-[background-color,color,box-shadow] duration-100 hover:bg-accent",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  ),
  selected:
    "[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-background [&>button]:hover:bg-primary [&>button]:hover:text-background",
  range_start:
    "rounded-l-md bg-primary/10 [&>button]:rounded-r-none [&>button]:bg-primary [&>button]:font-semibold [&>button]:text-background",
  range_end:
    "rounded-r-md bg-primary/10 [&>button]:rounded-l-none [&>button]:bg-primary [&>button]:font-semibold [&>button]:text-background",
  range_middle:
    "bg-primary/10 [&>button]:rounded-none [&>button]:bg-transparent [&>button]:font-normal [&>button]:text-foreground [&>button]:hover:bg-primary/10",
  // Today reads as a dot under the numeral — a ring would compete with the
  // selected fill and with the focus ring.
  today: cn(
    "[&>button]:relative",
    "[&>button]:after:pointer-events-none [&>button]:after:absolute [&>button]:after:bottom-1 [&>button]:after:left-1/2",
    "[&>button]:after:size-1 [&>button]:after:-translate-x-1/2 [&>button]:after:rounded-full [&>button]:after:bg-primary",
    // On the selected fill the dot matches the numeral (dark on primary);
    // primary-foreground would read as a stray white speck.
    "[&[data-selected]>button]:after:bg-background",
    "[&[data-disabled]>button]:after:bg-foreground/30",
  ),
  outside: "[&>button]:text-muted-foreground [&>button]:opacity-40",
  disabled: "[&>button]:cursor-not-allowed [&>button]:opacity-30",
  hidden: "invisible",
};

/**
 * Month/year caption dropdown — a real native <select> laid over its own
 * label. Native beats a custom popover-in-popover here: on touch devices it
 * opens the OS's own scrollable picker instead of a cramped nested list.
 * The label stays in flow (the select is an invisible overlay) so the control
 * is exactly as wide as "July" — a select sized to its widest option would
 * strand the caption left of centre.
 */
function AppCalendarDropdown({
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
  const selected = (options ?? []).find((o) => String(o.value) === String(value));

  return (
    <span
      className={cn(
        "relative inline-flex h-7 items-center gap-1 rounded-md px-1.5 capitalize",
        "transition-colors hover:bg-accent",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
        disabled && "opacity-64",
      )}
    >
      <span aria-hidden>{selected?.label ?? String(value)}</span>
      <ChevronDown size={12} strokeWidth={1.75} className="text-muted-foreground" aria-hidden />
      <select
        // ≥16px so iOS Safari doesn't zoom the page when the picker opens.
        className="absolute inset-0 cursor-pointer appearance-none bg-transparent text-base opacity-0 outline-none disabled:cursor-not-allowed"
        value={String(value)}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        {(options ?? []).map((o) => (
          <NativeSelectOption key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </NativeSelectOption>
        ))}
      </select>
    </span>
  );
}

/** shadcn-style calendar adapted to shadcn tokens. */
export function AppCalendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("app-calendar", className)}
      classNames={{
        ...appCalendarClassNames,
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
        Dropdown: AppCalendarDropdown,
        ...props.components,
      }}
      {...props}
    />
  );
}
