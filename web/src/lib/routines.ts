import type { RoutineStage } from "./api/routines";

/** Today on the device clock as YYYY-MM-DD: routines run on the person's calendar. */
export function localDay(date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** `day` shifted by n calendar days (n may be negative). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + n));
}

export const STAGES: { value: RoutineStage; label: string }[] = [
  { value: "pre", label: "Before trading" },
  { value: "during", label: "During trading" },
  { value: "post", label: "After trading" },
];

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Every day", "Weekdays", "Weekends" or the listed days, Monday first. */
export function weekdaysLabel(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return "Every day";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => set.has(d))
    .map((d) => WEEKDAY_SHORT[d])
    .join(", ");
}
