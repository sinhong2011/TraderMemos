import type { Filters } from "./api/types";
import { computePresetRange } from "./dateRangePresets";
import { normalizeFilterDate } from "./filters";

export type GoalPaceStatus = "on_track" | "behind" | "ahead" | "over";

export interface AnnualGoalProgress {
  year: number;
  goal: number;
  ytdNetPnl: number;
  /** 0–1+ (may exceed 1 when over goal). */
  progress: number;
  /** Display percent, floored at 0. */
  progressPct: number;
  remaining: number;
  overBy: number;
  expectedPace: number;
  paceDelta: number;
  paceStatus: GoalPaceStatus;
  dayOfYear: number;
  daysInYear: number;
}

/** Filters for calendar-year YTD net P&L (keeps account/side filters). */
export function ytdFiltersForYear(base: Filters, year: number, now = new Date()): Filters {
  const isCurrentYear = year === now.getFullYear();
  if (isCurrentYear) {
    const range = computePresetRange("ytd", now);
    return { ...base, from: range.from, to: range.to };
  }
  return {
    ...base,
    from: normalizeFilterDate(`${year}-01-01`, "start"),
    to: normalizeFilterDate(`${year}-12-31`, "end"),
  };
}

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getFullYear(), 0, 1);
  const current = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((current - start) / 86_400_000) + 1;
}

function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

/** Linear YTD expected P&L for the goal. */
export function linearExpectedPace(goal: number, now = new Date()): number {
  const diy = daysInYear(now.getFullYear());
  const doy = dayOfYear(now);
  return goal * (doy / diy);
}

export function computeAnnualGoalProgress(
  goal: number,
  ytdNetPnl: number,
  year: number,
  now = new Date(),
): AnnualGoalProgress {
  const diy = daysInYear(year);
  const doy = year === now.getFullYear() ? dayOfYear(now) : diy;
  const expectedPace = goal * (doy / diy);
  const progress = goal > 0 ? ytdNetPnl / goal : 0;
  const progressPct = Math.max(0, progress * 100);
  const remaining = Math.max(0, goal - ytdNetPnl);
  const overBy = Math.max(0, ytdNetPnl - goal);

  let paceStatus: GoalPaceStatus;
  if (ytdNetPnl >= goal) {
    paceStatus = "over";
  } else {
    const delta = ytdNetPnl - expectedPace;
    const band = Math.max(goal * 0.02, 1);
    if (delta >= band) paceStatus = "ahead";
    else if (delta <= -band) paceStatus = "behind";
    else paceStatus = "on_track";
  }

  return {
    year,
    goal,
    ytdNetPnl,
    progress,
    progressPct,
    remaining,
    overBy,
    expectedPace,
    paceDelta: ytdNetPnl - expectedPace,
    paceStatus,
    dayOfYear: doy,
    daysInYear: diy,
  };
}
