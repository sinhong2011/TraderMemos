import { apiFetch, qs } from "./client";
import type { Filters } from "./types";

export type DecisionId =
  | "market"
  | "selection"
  | "setup"
  | "trigger"
  | "risk_budget"
  | "trade_risk"
  | "position_size"
  | "portfolio"
  | "scaling"
  | "definition"
  | "evidence"
  | "diagnosis"
  | "action"
  | "measure"
  | "review"
  | "adjust";

export type SystemPart = "entry" | "sizing" | "exit" | "review";
export type Stance = "normal" | "defensive" | "paused";
export type ExitState = "wrong" | "not_working" | "finished" | "other";
export type Adherence = "full" | "partial" | "none";
export type ChecklistItem =
  | "planned_entry"
  | "preset_exit"
  | "risk_as_planned"
  | "exit_by_plan"
  | "no_manual_edits";
export type ChangeReason = "execution" | "regime" | "risk" | "other";
export type SampleBand = "thin" | "indicative" | "adequate";

export interface Rule {
  text: string;
  executable: boolean;
}

export interface SystemVersion {
  id: string;
  label: string;
  status: "draft" | "active" | "retired";
  rules: Record<DecisionId, Rule>;
  open_questions: Record<string, string>;
  regimes: Record<string, string>;
  trade_types: Record<string, string>;
  activated_at: string | null;
  retired_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanStep {
  week: number;
  key: "write" | "test" | "live" | "revise";
  progress: number;
  target: number;
  done: boolean;
}

export interface TradingSystem {
  id: string;
  name: string;
  active: SystemVersion | null;
  draft: SystemVersion | null;
  history: SystemVersion[];
  plan: PlanStep[];
}

export interface SystemVersionBody {
  label: string;
  rules: Record<string, Rule>;
  open_questions: Record<string, string>;
  regimes: Record<string, string>;
  trade_types: Record<string, string>;
}

export interface ChangeBody {
  decision: DecisionId;
  reason: ChangeReason;
  note: string;
  evidence_trade_ids?: string[];
}

export interface SystemChange {
  id: string;
  version_id: string;
  decision: DecisionId;
  reason: ChangeReason;
  note: string;
  evidence_trade_ids: string[];
  created_at: string;
}

export interface MarketRegimeDay {
  day: string;
  regime: string;
  note: string;
}

export interface TradeSystemCard {
  trade_id: string;
  version_id: string | null;
  version_label: string;
  regime: string;
  day_regime: string;
  trigger_met: string;
  trade_type: string;
  thesis: string;
  planned_hold_days: number | null;
  time_stop_days: number | null;
  exit_state: string;
  adherence: string;
  suggested_adherence: string;
  checklist: Partial<Record<ChecklistItem, boolean>>;
  lesson: string;
  rule_change: boolean;
  planned_at: string | null;
}

export type TradeSystemCardBody = Partial<{
  version_id: string | null;
  regime: string;
  trigger_met: string;
  trade_type: string;
  thesis: string;
  planned_hold_days: number | null;
  time_stop_days: number | null;
  exit_state: string;
  adherence: string;
  checklist: Partial<Record<ChecklistItem, boolean>>;
  lesson: string;
  rule_change: boolean;
  planned_at: string | null;
}>;

export interface ReviewCell {
  trades: number;
  net_pnl: number;
  sum_r: number;
  has_r: number;
}

export interface ReviewStats {
  key: string;
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number | null;
  net_pnl: number;
  expectancy_r: number | null;
  avg_hold_secs: number;
  sample: SampleBand;
}

export interface SystemReview {
  coverage: {
    closed: number;
    carded: number;
    regime: number;
    adherence: number;
    exit_state: number;
    planned_ahead: number;
  };
  quadrant: {
    right_win: ReviewCell;
    right_loss: ReviewCell;
    wrong_win: ReviewCell;
    wrong_loss: ReviewCell;
  };
  by_regime: ReviewStats[];
  by_setup: ReviewStats[];
  by_exit_state: ReviewStats[];
  by_trade_type: ReviewStats[];
  by_version: ReviewStats[];
  by_adherence: ReviewStats[];
  streak: {
    length: number;
    chance: number;
    causes: { key: string; score: number; detail: string; suggest: string }[];
  } | null;
  missed_hesitated: number;
  adherence_rate: number | null;
}

const filterQs = (f: Filters & { version_id?: string }) =>
  qs(f as Record<string, string | undefined>);

export const systemApi = {
  get: () => apiFetch<TradingSystem>("/system"),
  startVersion: () => apiFetch<SystemVersion>("/system/versions", { method: "POST" }),
  getVersion: (id: string) => apiFetch<SystemVersion>(`/system/versions/${id}`),
  saveVersion: (id: string, body: SystemVersionBody) =>
    apiFetch<SystemVersion>(`/system/versions/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  discardDraft: (id: string) => apiFetch<void>(`/system/versions/${id}`, { method: "DELETE" }),
  activate: (id: string, changes: ChangeBody[]) =>
    apiFetch<SystemVersion>(`/system/versions/${id}/activate`, {
      method: "POST",
      body: JSON.stringify({ changes }),
    }),
  changes: () => apiFetch<SystemChange[]>("/system/changes"),
  getRegime: (day: string) => apiFetch<MarketRegimeDay>(`/system/regimes/${day}`),
  putRegime: (day: string, body: { regime: string; note?: string }) =>
    apiFetch<MarketRegimeDay>(`/system/regimes/${day}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getCard: (tradeId: string) => apiFetch<TradeSystemCard>(`/trades/${tradeId}/system-card`),
  putCard: (tradeId: string, body: TradeSystemCardBody) =>
    apiFetch<TradeSystemCard>(`/trades/${tradeId}/system-card`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  review: (f: Filters & { version_id?: string }) =>
    apiFetch<SystemReview>(`/analytics/system-review${filterQs(f)}`),
};
