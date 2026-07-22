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
  error?: string;
}
