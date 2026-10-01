import { apiFetch, qs } from "./client";
import type { Filters } from "./types";

export type MissedOutcome = "unknown" | "target" | "stop" | "no_trigger";
export type MissedReason = "" | "hesitated" | "away" | "rules" | "other";

/** Go: api.missedTradeDTO. */
export interface MissedTrade {
  id: string;
  account_id: string | null;
  setup_id: string | null;
  symbol: string;
  direction: "long" | "short";
  observed_at: string;
  entry: number | null;
  stop: number | null;
  target: number | null;
  reason: MissedReason;
  outcome: MissedOutcome;
  notes: string;
  /** Reward over risk of a full, coherent plan. */
  planned_r: number | null;
  /** What it would have made given the outcome; null while unknown. */
  r: number | null;
  created_at: string;
  updated_at: string;
}

export type MissedTradeBody = Omit<
  MissedTrade,
  "id" | "planned_r" | "r" | "created_at" | "updated_at"
>;

export interface MissedGroup {
  key: string;
  count: number;
  scored: number;
  net_r: number;
}

/** Payload of GET /missed-trades/summary (Go: analytics.MissedSummary). */
export interface MissedSummary {
  count: number;
  outcomes: Record<MissedOutcome, number>;
  scored: number;
  r_left: number;
  r_avoided: number;
  net_r: number;
  avg_r: number | null;
  by_reason: MissedGroup[];
  by_setup: MissedGroup[];
  unpriced: number;
}

const filterQs = (f: Filters) => qs(f as Record<string, string | undefined>);

export const missedTradesApi = {
  list: (f: Filters) => apiFetch<MissedTrade[]>(`/missed-trades${filterQs(f)}`),
  summary: (f: Filters) => apiFetch<MissedSummary>(`/missed-trades/summary${filterQs(f)}`),
  create: (body: MissedTradeBody) =>
    apiFetch<MissedTrade>("/missed-trades", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: MissedTradeBody) =>
    apiFetch<MissedTrade>(`/missed-trades/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => apiFetch<void>(`/missed-trades/${id}`, { method: "DELETE" }),
};
