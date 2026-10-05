import { apiFetch } from "./client";

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

export const focusApi = {
  current: () => apiFetch<WeeklyFocus>("/focus/current"),
};
