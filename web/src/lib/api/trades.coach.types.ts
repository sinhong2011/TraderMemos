/** Response from POST /trades/:id/coach */
export type TradeCoachSource = "llm" | "off" | "error";

export interface TradeCoachApiNote {
  id: string;
  tone: "neg" | "warn" | "pos" | "tip";
  headline: string;
  detail: string;
  priority: number;
}

export interface TradeCoachReview {
  source: TradeCoachSource;
  notes: TradeCoachApiNote[];
  /** The one concrete step to take before the next trade; absent if the model omitted it. */
  next_action?: string;
  error?: string;
  /** Set once the review is stored; absent when the write failed. */
  id?: string;
  created_at?: string;
}

/** One previously stored review, from GET /trades/:id/coach/reviews. */
export interface StoredTradeCoachReview {
  id: string;
  notes: TradeCoachApiNote[];
  next_action?: string;
  model?: string;
  created_at: string;
}

export interface TradeCoachReviewHistory {
  reviews: StoredTradeCoachReview[];
}
