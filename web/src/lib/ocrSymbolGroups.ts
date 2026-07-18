/** Helpers for OCR extracts that may span multiple underlyings. */

import type { ExtractedFill, TradeExtract } from "./api/ocr";

export type OcrSymbolGroup = {
  symbol: string;
  fillCount: number;
  side: "long" | "short" | "";
  instrument: "option" | "stock";
  /** e.g. "375 Put · 2026-07-20" */
  contractLabel: string;
  buyQty: number;
  sellQty: number;
};

export function ocrSymbolsInExtract(extract: TradeExtract): string[] {
  if (extract.symbols?.length) {
    return [...extract.symbols].map((s) => s.toUpperCase()).sort((a, b) => a.localeCompare(b));
  }
  const set = new Set<string>();
  for (const r of extract.rows ?? []) {
    const s = r.symbol?.trim().toUpperCase();
    if (s) set.add(s);
  }
  if (extract.symbol?.trim()) set.add(extract.symbol.trim().toUpperCase());
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function filterOcrExtractBySymbol(extract: TradeExtract, symbol: string): TradeExtract {
  const sym = symbol.trim().toUpperCase();
  const allHaveSymbol = (extract.rows ?? []).every((r) => Boolean(r.symbol?.trim()));
  const rows = (extract.rows ?? []).filter((r) => {
    const rs = r.symbol?.trim().toUpperCase();
    // When every fill is tagged, require an exact match. Otherwise keep
    // untagged fills with the chosen symbol (single-symbol / legacy OCR).
    if (!rs) return !allHaveSymbol;
    return rs === sym;
  });
  const sorted = [...rows].sort((a, b) => (a.executed_at ?? "").localeCompare(b.executed_at ?? ""));
  const earliest = sorted[0];
  const side =
    earliest?.side === "sell" ? "short" : earliest?.side === "buy" ? "long" : extract.side;
  const isOption = sorted.some(
    (r) => Boolean(r.option_right) || Boolean(r.strike) || Boolean(r.expiry),
  );
  return {
    ...extract,
    symbol: sym,
    side,
    instrument_type: isOption ? "option" : "stock",
    rows: sorted,
    symbols: ocrSymbolsInExtract(extract),
  };
}

export function defaultOcrSymbol(extract: TradeExtract): string {
  const symbols = ocrSymbolsInExtract(extract);
  if (extract.symbol?.trim()) {
    const pref = extract.symbol.trim().toUpperCase();
    if (symbols.includes(pref) || symbols.length === 0) return pref;
  }
  // Prefer the symbol with the most fills.
  const counts = new Map<string, number>();
  for (const r of extract.rows ?? []) {
    const s = r.symbol?.trim().toUpperCase();
    if (!s) continue;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let best = symbols[0] ?? "";
  let bestN = -1;
  for (const [s, n] of counts) {
    if (n > bestN) {
      best = s;
      bestN = n;
    }
  }
  return best;
}

function contractLabelFromRows(rows: ExtractedFill[]): string {
  const withContract = rows.find((r) => r.option_right || r.strike || r.expiry);
  if (!withContract) return "";
  const right =
    withContract.option_right === "put" || withContract.option_right === "call"
      ? withContract.option_right
      : "";
  const strike = withContract.strike && withContract.strike > 0 ? String(withContract.strike) : "";
  const expiry = withContract.expiry?.trim() ?? "";
  const parts = [strike && right ? `${strike} ${right}` : right || strike, expiry].filter(Boolean);
  return parts.join(" · ");
}

/** Group OCR fills by ticker for the New Trade picker. Majority-first order. */
export function groupOcrBySymbol(extract: TradeExtract): OcrSymbolGroup[] {
  const symbols = ocrSymbolsInExtract(extract);
  const groups: OcrSymbolGroup[] = symbols.map((symbol) => {
    const scoped = filterOcrExtractBySymbol(extract, symbol);
    const rows = scoped.rows ?? [];
    let buyQty = 0;
    let sellQty = 0;
    for (const r of rows) {
      if (r.side === "buy") buyQty += r.quantity || 0;
      else if (r.side === "sell") sellQty += r.quantity || 0;
    }
    return {
      symbol,
      fillCount: rows.length,
      side: scoped.side === "long" || scoped.side === "short" ? scoped.side : "",
      instrument: scoped.instrument_type === "option" ? "option" : "stock",
      contractLabel: contractLabelFromRows(rows),
      buyQty,
      sellQty,
    };
  });
  // Majority fills first, then alpha.
  groups.sort((a, b) => b.fillCount - a.fillCount || a.symbol.localeCompare(b.symbol));
  return groups;
}

/** Next unscanned / unlogged symbol after `current`, wrapping through the group list. */
export function nextOcrSymbol(
  extract: TradeExtract,
  current: string,
  logged: ReadonlySet<string>,
): string | null {
  const groups = groupOcrBySymbol(extract);
  if (groups.length === 0) return null;
  const cur = current.trim().toUpperCase();
  const start = Math.max(
    0,
    groups.findIndex((g) => g.symbol === cur),
  );
  // Walk other groups only (do not return the current symbol).
  for (let i = 1; i < groups.length; i++) {
    const g = groups[(start + i) % groups.length];
    if (!logged.has(g.symbol)) return g.symbol;
  }
  return null;
}

/** Prefer actionable OCR warnings for the post-scan toast body. */
export function ocrScanToastDescription(extract: TradeExtract): string {
  const warnings = extract.warnings ?? [];
  const priority = [
    /merged \d+ screenshot/i,
    /vision extract/i,
    /no usable fills/i,
    /multiple symbols/i,
    /commission|Trades tab/i,
    /no fills detected/i,
  ];
  for (const re of priority) {
    const hit = warnings.find((w) => re.test(w));
    if (hit) return hit;
  }
  const n = groupOcrBySymbol(extract).length;
  return `${n} symbol${n === 1 ? "" : "s"} ready to review.`;
}

/** Combine extracts from multiple screenshots into one fill set. */
export function mergeTradeExtracts(parts: TradeExtract[]): TradeExtract {
  if (parts.length === 0) {
    return {
      symbol: "",
      instrument_type: "stock",
      side: "",
      confidence: 0,
      raw_text: "",
      rows: [],
      warnings: [],
    };
  }
  if (parts.length === 1) return parts[0]!;

  const rows = parts.flatMap((p) => p.rows ?? []);
  const symbolSet = new Set<string>();
  for (const p of parts) {
    for (const s of ocrSymbolsInExtract(p)) symbolSet.add(s);
  }
  const warnings = parts.flatMap((p, i) => (p.warnings ?? []).map((w) => `[image ${i + 1}] ${w}`));
  warnings.unshift(`Merged ${parts.length} screenshots (${rows.length} fills).`);

  const confidence =
    parts.reduce((sum, p) => sum + (Number.isFinite(p.confidence) ? p.confidence : 0), 0) /
    parts.length;

  const merged: TradeExtract = {
    symbol: parts[0]?.symbol ?? "",
    instrument_type: parts[0]?.instrument_type || "stock",
    side: parts[0]?.side || "",
    confidence,
    raw_text: parts
      .map((p) => p.raw_text?.trim())
      .filter(Boolean)
      .join("\n---\n"),
    rows,
    warnings,
    symbols: [...symbolSet].sort((a, b) => a.localeCompare(b)),
  };
  const majority = defaultOcrSymbol(merged);
  if (majority) merged.symbol = majority;

  const sorted = [...rows].sort((a, b) => (a.executed_at ?? "").localeCompare(b.executed_at ?? ""));
  const earliest = sorted[0];
  if (earliest?.side === "sell") merged.side = "short";
  else if (earliest?.side === "buy") merged.side = "long";

  const isOption = sorted.some(
    (r) => Boolean(r.option_right) || Boolean(r.strike) || Boolean(r.expiry),
  );
  if (isOption) merged.instrument_type = "option";

  return merged;
}

export type { ExtractedFill, TradeExtract };
