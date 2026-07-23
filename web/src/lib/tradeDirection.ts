/** Shared long/short + option-right direction display (Dir column). */

export type DirTag = "LC" | "LP" | "SC" | "SP" | "?" | null;
export type DirTone = "profit" | "loss" | "signal" | "muted";

export interface TradeDirectionView {
  long: boolean;
  tag: DirTag;
  tone: DirTone;
  /** Arrow follows bias for tagged options (LC/SP up, LP/SC down); else side. */
  arrowUp: boolean;
  /** Short accessible / tooltip title, e.g. "Long Call". */
  label: string;
  /** Extra hover line, e.g. "Side long · Call". */
  detail: string;
  /** Stable sort key. */
  sortKey: string;
}

export function isLongDirection(sideOrDirection: string): boolean {
  const s = sideOrDirection.trim().toLowerCase();
  return s === "long" || s === "buy";
}

/**
 * Infer call/put from OCC-style symbols (mirrors api/internal/importer InferOptionRight).
 * Returns "call", "put", or "".
 */
export function inferOptionRightFromSymbol(symbol: string): "" | "call" | "put" {
  const s = symbol.trim();
  if (!s) return "";
  for (const part of s.split(/\s+/)) {
    const token = part.trim().toLowerCase();
    if (token === "call") return "call";
    if (token === "put") return "put";
  }
  const compact = s.replace(/\s+/g, "").toUpperCase();
  const fromCompact = optionRightFromOCC(compact);
  if (fromCompact) return fromCompact;
  const parts = s.split(/\s+/);
  if (parts.length >= 2) {
    return optionRightFromOCC(parts[parts.length - 1]!.toUpperCase());
  }
  return "";
}

function optionRightFromOCC(s: string): "" | "call" | "put" {
  const upper = s.toUpperCase();
  for (let i = 1; i < upper.length - 1; i++) {
    const ch = upper[i];
    const prev = upper[i - 1]!;
    const next = upper[i + 1]!;
    if (ch === "C" && isDigit(prev) && isDigit(next)) return "call";
    if (ch === "P" && isDigit(prev) && isDigit(next)) return "put";
  }
  return "";
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

export function resolveOptionRight(input: {
  instrumentType?: string;
  optionRight?: string | null;
  symbol?: string;
}): "" | "call" | "put" {
  if (input.instrumentType && input.instrumentType !== "option") return "";
  const raw = (input.optionRight ?? "").trim().toLowerCase();
  if (raw === "call" || raw === "put") return raw;
  if (input.symbol) return inferOptionRightFromSymbol(input.symbol);
  return "";
}

export function resolveTradeDirection(input: {
  direction: string;
  instrumentType?: string;
  optionRight?: string | null;
  symbol?: string;
  /** When true and option lacks call/put, show "?" instead of a bare arrow. */
  markMissingOptionRight?: boolean;
}): TradeDirectionView {
  const long = isLongDirection(input.direction);
  const isOption = input.instrumentType === "option";
  const right = resolveOptionRight(input);
  const missing = Boolean(isOption && !right && input.markMissingOptionRight);

  let tag: DirTag = null;
  let tone: DirTone = "muted";

  if (right === "call") {
    tag = long ? "LC" : "SC";
    tone = long ? "profit" : "loss";
  } else if (right === "put") {
    tag = long ? "LP" : "SP";
    tone = long ? "loss" : "profit";
  } else if (missing) {
    tag = "?";
    tone = "signal";
  }

  const arrowUp = tag === "LC" || tag === "SP" ? true : tag === "LP" || tag === "SC" ? false : long;

  const sideLabel = long ? "Long" : "Short";
  let label = sideLabel;
  let detail = `Side ${sideLabel.toLowerCase()}`;
  let sortKey = long ? "long" : "short";

  if (tag === "LC") {
    label = "Long Call";
    detail = "Side long · Call";
    sortKey = "LC";
  } else if (tag === "LP") {
    label = "Long Put";
    detail = "Side long · Put";
    sortKey = "LP";
  } else if (tag === "SC") {
    label = "Short Call";
    detail = "Side short · Call";
    sortKey = "SC";
  } else if (tag === "SP") {
    label = "Short Put";
    detail = "Side short · Put";
    sortKey = "SP";
  } else if (missing) {
    label = "Option — call/put missing";
    detail = `${sideLabel} · set call or put via Edit`;
    sortKey = long ? "long?" : "short?";
  } else if (isOption) {
    detail = `${sideLabel} · option`;
  }

  return { long, tag, tone, arrowUp, label, detail, sortKey };
}
