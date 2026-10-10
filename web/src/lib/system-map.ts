import type { DecisionId, Rule, SystemPart } from "@/lib/api/system";
import { DECISIONS, partOf } from "@/lib/system";

/** Fixed map nodes — stable IDs used in the URL and React Flow. */
export type MapNodeId = "market" | "entry" | "risk" | "holding" | "review";

export type RuleClarity = "empty" | "needs_clarity" | "self_clear";

export interface MapNodeDef {
  id: MapNodeId;
  decisions: DecisionId[];
  /** Optional static branch shown on the entry node. */
  branchLabelKey?: "keep_watching";
}

export const MAP_NODES: MapNodeDef[] = [
  { id: "market", decisions: ["market"] },
  {
    id: "entry",
    decisions: ["selection", "setup", "trigger"],
    branchLabelKey: "keep_watching",
  },
  { id: "risk", decisions: ["risk_budget", "trade_risk", "position_size", "portfolio"] },
  { id: "holding", decisions: ["scaling", "definition", "evidence", "diagnosis", "action"] },
  { id: "review", decisions: ["measure", "review", "adjust"] },
];

export const MAP_EDGES: { id: string; source: MapNodeId; target: MapNodeId; labelKey?: string }[] =
  [
    { id: "e-market-entry", source: "market", target: "entry" },
    { id: "e-entry-risk", source: "entry", target: "risk" },
    { id: "e-risk-holding", source: "risk", target: "holding" },
    { id: "e-holding-review", source: "holding", target: "review" },
    {
      id: "e-entry-watch",
      source: "entry",
      target: "entry",
      labelKey: "keep_watching",
    },
  ];

/** Fixed desktop layout positions (React Flow coords). */
export const MAP_POSITIONS: Record<MapNodeId, { x: number; y: number }> = {
  market: { x: 40, y: 40 },
  entry: { x: 280, y: 40 },
  risk: { x: 520, y: 40 },
  holding: { x: 280, y: 220 },
  review: { x: 520, y: 220 },
};

export function isMapNodeId(v: string | null | undefined): v is MapNodeId {
  return MAP_NODES.some((n) => n.id === v);
}

export function decisionsForNode(id: MapNodeId): DecisionId[] {
  return MAP_NODES.find((n) => n.id === id)?.decisions ?? [];
}

export function nodeForDecision(d: DecisionId): MapNodeId {
  for (const n of MAP_NODES) {
    if (n.decisions.includes(d)) return n.id;
  }
  return "review";
}

/**
 * Clarity of one decision in write-rules mode.
 * Priority for a node: needs_clarity > empty > self_clear.
 */
export function decisionClarity(rule: Rule | undefined, openQuestion?: string): RuleClarity {
  const text = rule?.text?.trim() ?? "";
  const oq = openQuestion?.trim() ?? "";
  if (oq || (text && !rule?.executable)) return "needs_clarity";
  if (!text) return "empty";
  return "self_clear";
}

export function nodeClarity(
  nodeId: MapNodeId,
  rules: Partial<Record<DecisionId, Rule>> | undefined,
  openQuestions?: Partial<Record<SystemPart, string>>,
): RuleClarity {
  const decisions = decisionsForNode(nodeId);
  let worst: RuleClarity = "self_clear";
  let any = false;
  for (const d of decisions) {
    any = true;
    const c = decisionClarity(rules?.[d], openQuestions?.[partOf(d)]);
    if (c === "needs_clarity") return "needs_clarity";
    if (c === "empty") worst = "empty";
  }
  return any ? worst : "empty";
}

/** Four starter prompts for an empty system (entry, risk, exit, pause). */
export const STARTER_DECISIONS: DecisionId[] = ["trigger", "trade_risk", "action", "market"];

export function starterPrompt(id: DecisionId): boolean {
  return STARTER_DECISIONS.includes(id);
}

export function allDecisionIds(): DecisionId[] {
  return [...DECISIONS];
}
