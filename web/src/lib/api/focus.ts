import { apiFetch, qs } from "./client";
import type { Filters } from "./types";

/** Payload of GET /focus/current. */
export interface WeeklyFocus {
  /** Monday (market timezone) of the week the focus applies to. */
  week_start: string;
  /** Up to three items from the last weekly review's "Focus for next week". */
  items: string[];
  /** The review that set it; "" when there is none. */
  note_id: string;
  note_title: string;
}

/** One focus item as the following weekly review scored it. */
export interface FocusOutcome {
  text: string;
  /** Ticked. Unticked means missed or never scored — the checklist can't tell. */
  kept: boolean;
}

/** Payload of GET /focus/history. */
export interface FocusHistory {
  /** Scored weeks, newest first. */
  weeks: { week_start: string; items: FocusOutcome[]; note_id: string; note_title: string }[];
  items_total: number;
  items_kept: number;
  /** Weeks with every item ticked. */
  weeks_all_kept: number;
}

export const focusApi = {
  current: () => apiFetch<WeeklyFocus>("/focus/current"),
  history: (f: Pick<Filters, "from" | "to">) =>
    apiFetch<FocusHistory>(`/focus/history${qs({ from: f.from, to: f.to })}`),
};
