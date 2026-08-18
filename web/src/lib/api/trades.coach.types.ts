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
}
