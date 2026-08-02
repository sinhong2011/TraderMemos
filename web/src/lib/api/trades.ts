import { apiFetch, qs } from "./client";
import type { TradeCoachReview } from "./trades.coach.types";
import type { Filters, Trade, TradeDetail } from "./types";

export type { TradeCoachApiNote, TradeCoachReview, TradeCoachSource } from "./trades.coach.types";

export interface TradeExcursion {
  mae: number;
  mfe: number;
  interval: string;
  bars_used: number;
  provider: string;
  post_exit_mae: number | null;
  post_exit_mfe: number | null;
}

export const tradesApi = {
  list: (f: Filters) => apiFetch<Trade[]>(`/trades${qs(f as Record<string, string | undefined>)}`),
  get: (id: string) => apiFetch<TradeDetail>(`/trades/${id}`),
  /** LLM coach review when enabled in settings; otherwise source "off". */
  coach: (id: string) =>
    apiFetch<TradeCoachReview>(`/trades/${id}/coach`, {
      method: "POST",
    }),
  patch: (
    id: string,
    body: {
      notes?: string;
      setup_id?: string;
      setup_ids?: string[];
      initial_risk?: number;
      target_price?: number;
      stop_price?: number;
      emotional_state?: string;
      confidence?: number;
      trade_quality?: number;
      mae?: number;
      mfe?: number;
      tag_ids?: string[];
    },
  ) =>
    apiFetch<TradeDetail>(`/trades/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  /** Compute MAE/MFE from market bars and save them into the journal. */
  computeExcursion: (id: string) =>
    apiFetch<TradeExcursion>(`/trades/${id}/excursion`, {
      method: "POST",
    }),
  regroup: (account_id: string) =>
    apiFetch<void>("/trades/regroup", {
      method: "POST",
      body: JSON.stringify({ account_id }),
    }),
  delete: (id: string) =>
    apiFetch<void>(`/trades/${id}`, {
      method: "DELETE",
    }),
};
