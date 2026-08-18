import { resolveMarketTimezone, useDisplayPrefs } from "@/lib/displayPrefs";
import { apiFetch, qs } from "./client";
import { postEventStream } from "./sse";
import type {
  TradeCoachApiNote,
  TradeCoachReview,
  TradeCoachReviewHistory,
} from "./trades.coach.types";
import type { Filters, Trade, TradeDetail } from "./types";

export type {
  StoredTradeCoachReview,
  TradeCoachApiNote,
  TradeCoachReview,
  TradeCoachReviewHistory,
  TradeCoachSource,
} from "./trades.coach.types";

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
  /**
   * LLM coach review when enabled in settings; otherwise source "off".
   * `tz` is the market timezone the server draws day and week boundaries in
   * when reconstructing the trader's state at the reviewed trade's entry.
   */
  coach: (id: string) =>
    apiFetch<TradeCoachReview>(
      `/trades/${id}/coach${qs({ tz: resolveMarketTimezone(useDisplayPrefs.getState().marketTimezone) })}`,
      { method: "POST" },
    ),
  /** Previously stored coach reviews for a trade, newest first. */
  coachReviews: (id: string) => apiFetch<TradeCoachReviewHistory>(`/trades/${id}/coach/reviews`),
  /**
   * Streaming coach review: `onNote` fires as each note lands, and the promise
   * resolves with the authoritative review — only that carries the next action
   * and the stored id.
   */
  coachStream: (
    id: string,
    onNote: (note: TradeCoachApiNote) => void,
    signal?: AbortSignal,
  ): Promise<TradeCoachReview> => {
    const tz = resolveMarketTimezone(useDisplayPrefs.getState().marketTimezone);
    let final: TradeCoachReview | undefined;
    let failure: string | undefined;
    return postEventStream(`/trades/${id}/coach/stream${qs({ tz })}`, {
      signal,
      onEvent: (event, data) => {
        try {
          if (event === "note") onNote(JSON.parse(data) as TradeCoachApiNote);
          else if (event === "done") final = JSON.parse(data) as TradeCoachReview;
          else if (event === "error") failure = (JSON.parse(data) as { message?: string }).message;
        } catch {
          // A frame we cannot parse is skipped; the done event is authoritative.
        }
      },
    }).then(() => {
      if (failure) throw new Error(failure);
      if (!final) throw new Error("The coach stream ended without a result");
      return final;
    });
  },
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
