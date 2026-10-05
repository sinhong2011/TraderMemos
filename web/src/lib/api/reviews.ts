import { apiFetch, qs } from "./client";
import type { Trade } from "./types";

/** Payload of GET /reviews/inbox. */
export interface ReviewInbox {
  /** Closed trades with no execution grade, newest first. */
  items: Trade[];
  window_days: number;
  /** Ungraded trades older than the window (and newer than any dismissed cutoff). */
  backlog: number;
}

export const reviewsApi = {
  inbox: (accountId?: string) =>
    apiFetch<ReviewInbox>(`/reviews/inbox${qs({ account_id: accountId })}`),
  dismissBacklog: () =>
    apiFetch<{ cutoff: string }>("/reviews/dismiss-backlog", { method: "POST" }),
};
