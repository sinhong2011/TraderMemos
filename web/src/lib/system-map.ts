import type { DecisionId, Rule, SystemPart } from "@/lib/api/system";
import { DECISIONS, partOf } from "@/lib/system";

/** Fixed map nodes — stable IDs used in the URL and React Flow. */
export type MapNodeId = "market" | "entry" | "risk" | "holding" | "review";

export type RuleClarity = "empty" | "needs_clarity" | "self_clear";

export type MapEdgeKind = "flow" | "branch" | "feedback";

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

export const MAP_EDGES: {
  id: string;
  source: MapNodeId;
  target: MapNodeId;
  kind: MapEdgeKind;
  labelKey?: "confirm_trigger" | "keep_watching" | "feedback";
  /** React Flow handle ids — vertical spine uses bottom→top. */
  sourceHandle?: string;
  targetHandle?: string;
}[] = [
  {
    id: "e-market-entry",
    source: "market",
    target: "entry",
    kind: "flow",
    sourceHandle: "bottom",
    targetHandle: "top",
  },
  {
    id: "e-entry-risk",
    source: "entry",
    target: "risk",
    kind: "flow",
    labelKey: "confirm_trigger",
    sourceHandle: "bottom",
    targetHandle: "top",
  },
  {
    id: "e-risk-holding",
    source: "risk",
    target: "holding",
    kind: "flow",
    sourceHandle: "bottom",
    targetHandle: "top",
  },
  {
    id: "e-holding-review",
    source: "holding",
    target: "review",
    kind: "flow",
    sourceHandle: "bottom",
    targetHandle: "top",
  },
  {
    id: "e-entry-watch",
    source: "entry",
    target: "entry",
    kind: "branch",
    labelKey: "keep_watching",
    sourceHandle: "right",
    targetHandle: "left",
  },
  {
    id: "e-review-feedback",
    source: "review",
    target: "market",
    kind: "feedback",
    labelKey: "feedback",
    sourceHandle: "left",
    targetHandle: "left",
  },
];

/** Branch node rendered beside Entry (not a selectable MapNodeId). */
export const WATCH_NODE_ID = "watch" as const;

/**
 * Fixed desktop layout — vertical spine matching the product draft
 * (Market → Entry → Risk → Holding → Review), with Keep-watching to the right.
 */
export const MAP_POSITIONS: Record<MapNodeId, { x: number; y: number }> = {
  market: { x: 72, y: 16 },
  entry: { x: 72, y: 148 },
  risk: { x: 72, y: 280 },
  holding: { x: 72, y: 412 },
  review: { x: 72, y: 544 },
};

export const WATCH_POSITION = { x: 480, y: 168 };

/** Client-only layout prefs — separate from version rules / API data. */
const LAYOUT_STORAGE_PREFIX = "tm-system-map-layout-v1:";

export type MapLayoutPositions = Record<string, { x: number; y: number }>;

export function defaultMapLayout(): MapLayoutPositions {
  const out: MapLayoutPositions = { [WATCH_NODE_ID]: { ...WATCH_POSITION } };
  for (const n of MAP_NODES) out[n.id] = { ...MAP_POSITIONS[n.id] };
  return out;
}

export function loadMapLayout(systemId: string): MapLayoutPositions {
  const fallback = defaultMapLayout();
  if (typeof localStorage === "undefined" || !systemId) return fallback;
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_PREFIX + systemId);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return fallback;
    const next = { ...fallback };
    for (const [id, pos] of Object.entries(parsed as Record<string, unknown>)) {
      if (!(id in fallback)) continue;
      if (!pos || typeof pos !== "object") continue;
      const x = (pos as { x?: unknown }).x;
      const y = (pos as { y?: unknown }).y;
      if (
        typeof x === "number" &&
        typeof y === "number" &&
        Number.isFinite(x) &&
        Number.isFinite(y)
      ) {
        next[id] = { x, y };
      }
    }
    return next;
  } catch {
    return fallback;
  }
}

export function saveMapLayout(systemId: string, positions: MapLayoutPositions): void {
  if (typeof localStorage === "undefined" || !systemId) return;
  try {
    localStorage.setItem(LAYOUT_STORAGE_PREFIX + systemId, JSON.stringify(positions));
  } catch {
    // quota / private mode — layout is best-effort
  }
}

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
  const states = decisionsForNode(nodeId).map((d) =>
    decisionClarity(rules?.[d], openQuestions?.[partOf(d)]),
  );
  if (states.every((c) => c === "empty")) return "empty";
  if (states.every((c) => c === "self_clear")) return "self_clear";
  return "needs_clarity";
}

/** First non-empty rule text on the node, for the map card subtitle. */
export function nodeSummaryLine(
  nodeId: MapNodeId,
  rules: Partial<Record<DecisionId, Rule>> | undefined,
): string {
  for (const d of decisionsForNode(nodeId)) {
    const text = rules?.[d]?.text?.trim();
    if (text) return text;
  }
  return "";
}

/** Four starter prompts for an empty system (entry, risk, exit, pause). */
export const STARTER_DECISIONS: DecisionId[] = ["trigger", "trade_risk", "action", "market"];

export function starterPrompt(id: DecisionId): boolean {
  return STARTER_DECISIONS.includes(id);
}

export function allDecisionIds(): DecisionId[] {
  return [...DECISIONS];
}
