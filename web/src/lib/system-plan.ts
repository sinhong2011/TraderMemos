import { t } from "@lingui/core/macro";
import type {
  ConditionAnswer,
  DecisionId,
  PlanCondition,
  PlanRevision,
  PlanRevisionBody,
  PlanStatus,
} from "@/lib/api/system";
import { parseAmountToNumber } from "@/lib/amountInput";
import { MAP_NODES, type MapNodeId } from "@/lib/system-map";

export const PLAN_STATUSES: PlanStatus[] = ["planned", "waiting", "taken", "skipped", "cancelled"];

/** Hand transitions the API accepts. "taken" only comes from linking a trade. */
export const PLAN_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  planned: ["waiting", "skipped", "cancelled"],
  waiting: ["planned", "skipped", "cancelled"],
  taken: [],
  skipped: ["planned"],
  cancelled: ["planned"],
};

export function isClosedStatus(s: PlanStatus): boolean {
  return s === "skipped" || s === "cancelled";
}

/** Skipping, cancelling and reopening are logged with a reason. */
export function transitionNeedsReason(from: PlanStatus, to: PlanStatus): boolean {
  return isClosedStatus(to) || isClosedStatus(from);
}

export function planStatusLabel(s: PlanStatus): string {
  switch (s) {
    case "planned":
      return t`Planned`;
    case "waiting":
      return t`Waiting for trigger`;
    case "taken":
      return t`Taken`;
    case "skipped":
      return t`Skipped`;
    case "cancelled":
      return t`Cancelled`;
  }
}

/** Status hue: primary stays reserved for selection. */
export function planStatusTone(s: PlanStatus): { pill: string; dot: string } {
  switch (s) {
    case "planned":
      return { pill: "bg-muted text-foreground", dot: "bg-muted-foreground" };
    case "waiting":
      return { pill: "bg-info/10 text-info-foreground", dot: "bg-info" };
    case "taken":
      return { pill: "bg-success/10 text-success-foreground", dot: "bg-success" };
    case "skipped":
      return { pill: "bg-warning/10 text-warning-foreground", dot: "bg-warning" };
    case "cancelled":
      return { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" };
  }
}

export function answerLabel(a: ConditionAnswer): string {
  switch (a) {
    case "":
      return t`Unanswered`;
    case "yes":
      return t`Met`;
    case "no":
      return t`Not met`;
    case "na":
      return t`N/A`;
  }
}

export type CheckState = "met" | "not_met" | "open";

export interface NodeCheck {
  state: CheckState;
  answered: number;
  total: number;
}

/**
 * A node is met once every decision has an answer and none is "no"; one "no"
 * marks it not met no matter what else is open.
 */
export function nodeCheck(
  decisions: DecisionId[],
  conditions: Partial<Record<DecisionId, PlanCondition>> | undefined,
): NodeCheck {
  let answered = 0;
  let failed = false;
  for (const d of decisions) {
    const a = conditions?.[d]?.answer ?? "";
    if (a) answered++;
    if (a === "no") failed = true;
  }
  const state: CheckState = failed
    ? "not_met"
    : answered === decisions.length && decisions.length > 0
      ? "met"
      : "open";
  return { state, answered, total: decisions.length };
}

export function nodeChecks(
  conditions: Partial<Record<DecisionId, PlanCondition>> | undefined,
): Record<MapNodeId, NodeCheck> {
  return Object.fromEntries(
    MAP_NODES.map((n) => [n.id, nodeCheck(n.decisions, conditions)]),
  ) as Record<MapNodeId, NodeCheck>;
}

export function checkLabel(s: CheckState): string {
  switch (s) {
    case "met":
      return t`Meets your rules`;
    case "not_met":
      return t`Breaks a rule`;
    case "open":
      return t`Still open`;
  }
}

export function checkTone(s: CheckState): { text: string; dot: string; pill: string } {
  switch (s) {
    case "met":
      return {
        text: "text-success-foreground",
        dot: "bg-success",
        pill: "bg-success/10 text-success-foreground",
      };
    case "not_met":
      return {
        text: "text-destructive-foreground",
        dot: "bg-destructive",
        pill: "bg-destructive/10 text-destructive-foreground",
      };
    case "open":
      return {
        text: "text-muted-foreground",
        dot: "bg-muted-foreground/50",
        pill: "bg-muted text-muted-foreground",
      };
  }
}

/** Form state for one revision; prices stay strings so partial input survives. */
export interface PlanDraft {
  setup: string;
  thesis: string;
  trigger: string;
  invalidation: string;
  entry: string;
  stop: string;
  target: string;
  conditions: Partial<Record<DecisionId, PlanCondition>>;
}

const priceText = (v: number | null | undefined) => (v == null ? "" : String(v));

export function draftFromRevision(rev: PlanRevision | null | undefined): PlanDraft {
  return {
    setup: rev?.setup ?? "",
    thesis: rev?.thesis ?? "",
    trigger: rev?.trigger ?? "",
    invalidation: rev?.invalidation ?? "",
    entry: priceText(rev?.entry_price),
    stop: priceText(rev?.stop_price),
    target: priceText(rev?.target_price),
    conditions: { ...rev?.conditions },
  };
}

export function draftToBody(d: PlanDraft): PlanRevisionBody {
  const conditions: Partial<Record<DecisionId, PlanCondition>> = {};
  for (const [k, c] of Object.entries(d.conditions) as [DecisionId, PlanCondition][]) {
    const note = c.note.trim();
    if (!c.answer && !note) continue;
    conditions[k] = { answer: c.answer, note };
  }
  return {
    setup: d.setup.trim(),
    thesis: d.thesis.trim(),
    trigger: d.trigger.trim(),
    invalidation: d.invalidation.trim(),
    entry_price: parseAmountToNumber(d.entry),
    stop_price: parseAmountToNumber(d.stop),
    target_price: parseAmountToNumber(d.target),
    conditions,
  };
}

/** Same content once normalized the way the API stores it. */
export function samePlanDraft(a: PlanDraft, b: PlanDraft): boolean {
  const norm = (d: PlanDraft) => {
    const body = draftToBody(d);
    const conds = Object.keys(body.conditions)
      .sort()
      .map((k) => [k, body.conditions[k as DecisionId]]);
    return JSON.stringify({ ...body, conditions: conds });
  };
  return norm(a) === norm(b);
}

export interface PlanPricing {
  problem: string | null;
  /** Reward-to-risk multiple when entry, stop and target are all set and coherent. */
  r: number | null;
}

export function planPricing(
  direction: "long" | "short",
  entry: number | null,
  stop: number | null,
  target: number | null,
): PlanPricing {
  if (entry != null && stop != null) {
    if (direction === "long" && !(stop < entry)) {
      return { problem: t`A long needs its stop below entry.`, r: null };
    }
    if (direction === "short" && !(stop > entry)) {
      return { problem: t`A short needs its stop above entry.`, r: null };
    }
  }
  if (entry != null && target != null) {
    if (direction === "long" && !(target > entry)) {
      return { problem: t`A long needs its target above entry.`, r: null };
    }
    if (direction === "short" && !(target < entry)) {
      return { problem: t`A short needs its target below entry.`, r: null };
    }
  }
  if (entry == null || stop == null || target == null) return { problem: null, r: null };
  return { problem: null, r: Math.abs(target - entry) / Math.abs(entry - stop) };
}
