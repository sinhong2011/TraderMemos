/**
 * Prefill plumbing for the trade form. Screenshot scans (POST /ocr/parse) and
 * local CSV/JSON files both produce a `TradeExtract`; one mapper scopes it to
 * a single symbol (the mobile form is single-symbol) and turns it into
 * `TradeFormValues` patches. Ports web ocrSymbolGroups.ts + newTradeBlocks.ts.
 */

import type { ExtractedFill, TradeExtract } from '@/api/types';
import {
  MARKETS,
  emptyFill,
  emptyTradeForm,
  nextFillKey,
  type FillDraft,
  type Market,
  type TradeFormValues,
} from './trade-form';

export function emptyExtract(): TradeExtract {
  return {
    symbol: '',
    instrument_type: 'stock',
    side: '',
    confidence: 0,
    raw_text: '',
    rows: [],
    warnings: [],
  };
}

export function symbolsInExtract(extract: TradeExtract): string[] {
  if (extract.symbols?.length) {
    return [...extract.symbols].map((s) => s.toUpperCase()).sort((a, b) => a.localeCompare(b));
  }
  const set = new Set<string>();
  for (const row of extract.rows ?? []) {
    const s = row.symbol?.trim().toUpperCase();
    if (s) set.add(s);
  }
  if (extract.symbol?.trim()) set.add(extract.symbol.trim().toUpperCase());
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function filterExtractBySymbol(extract: TradeExtract, symbol: string): TradeExtract {
  const sym = symbol.trim().toUpperCase();
  const allHaveSymbol = (extract.rows ?? []).every((row) => Boolean(row.symbol?.trim()));
  const rows = (extract.rows ?? []).filter((row) => {
    const rs = row.symbol?.trim().toUpperCase();
    // When every fill is tagged, require an exact match. Otherwise keep
    // untagged fills with the chosen symbol (single-symbol / legacy OCR).
    if (!rs) return !allHaveSymbol;
    return rs === sym;
  });
  const sorted = [...rows].sort((a, b) => (a.executed_at ?? '').localeCompare(b.executed_at ?? ''));
  const earliest = sorted[0];
  const side =
    earliest?.side === 'sell' ? 'short' : earliest?.side === 'buy' ? 'long' : extract.side;
  const isOption = sorted.some(
    (row) => Boolean(row.option_right) || Boolean(row.strike) || Boolean(row.expiry),
  );
  return {
    ...extract,
    symbol: sym,
    side,
    instrument_type: isOption ? 'option' : extract.instrument_type || 'stock',
    rows: sorted,
    symbols: symbolsInExtract(extract),
  };
}

/** Combine extracts from multiple screenshots into one fill set. */
export function mergeTradeExtracts(parts: TradeExtract[]): TradeExtract {
  if (parts.length === 0) return emptyExtract();
  if (parts.length === 1) return parts[0];

  const rows = parts.flatMap((p) => p.rows ?? []);
  const symbolSet = new Set<string>();
  for (const p of parts) {
    for (const s of symbolsInExtract(p)) symbolSet.add(s);
  }
  const warnings = parts.flatMap((p, i) => (p.warnings ?? []).map((w) => `[image ${i + 1}] ${w}`));
  const confidence =
    parts.reduce((sum, p) => sum + (Number.isFinite(p.confidence) ? p.confidence : 0), 0) /
    parts.length;

  return {
    ...parts[0],
    symbol: parts[0].symbol,
    rows,
    warnings,
    confidence,
    symbols: [...symbolSet].sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * Extract timestamps are the broker's on-screen wall-clock; any zone offset a
 * vision model appends (RFC3339 forces one) is fiction. Keep the literal
 * date/time digits as a local Date instead of converting between zones.
 */
export function wallClockToDate(raw: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw.trim());
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] ?? '0'),
    );
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function numField(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n) || n === 0) return '';
  return String(n);
}

function fillFromRow(row: ExtractedFill): FillDraft {
  return {
    key: nextFillKey(),
    side: row.side === 'sell' ? 'sell' : 'buy',
    executedAt: wallClockToDate(row.executed_at ?? ''),
    quantity: row.quantity > 0 ? String(row.quantity) : '',
    price: row.price > 0 ? String(row.price) : '',
    // Web folds commission into fees on OCR rows; keep them split when both exist.
    fees: numField(row.fees),
    commission: numField(row.commission),
  };
}

/** Build one form block from an extract scoped to a single symbol. */
function blockFromScopedExtract(scoped: TradeExtract, accountId: string): TradeFormValues {
  const rows = scoped.rows ?? [];
  const block = emptyTradeForm(accountId);
  if (scoped.symbol?.trim()) block.symbol = scoped.symbol.trim().toUpperCase();
  const market = scoped.instrument_type;
  if ((MARKETS as readonly string[]).includes(market)) block.market = market as Market;
  if (scoped.side === 'long' || scoped.side === 'short') block.direction = scoped.side;
  block.fills = rows.length > 0 ? rows.map(fillFromRow) : [emptyFill('buy')];

  const contract = rows.find((row) => row.option_right || row.strike || row.expiry);
  if (contract) {
    block.optionRight =
      contract.option_right === 'call' || contract.option_right === 'put'
        ? contract.option_right
        : '';
    block.optionStrike = contract.strike && contract.strike > 0 ? String(contract.strike) : '';
    block.optionExpiry = contract.expiry?.trim() ?? '';
  }
  return block;
}

export type TradePrefill = {
  /** One form block per underlying (web tradesFromOcrExtract), majority-fills first. */
  blocks: TradeFormValues[];
  warnings: string[];
};

/** Turn an extract into per-symbol form blocks — every underlying is kept. */
export function blocksFromExtract(extract: TradeExtract, accountId: string): TradePrefill {
  const symbols = symbolsInExtract(extract);
  const counts = new Map<string, number>();
  for (const row of extract.rows ?? []) {
    const s = row.symbol?.trim().toUpperCase();
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  symbols.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b));

  const blocks =
    symbols.length > 0
      ? symbols.map((symbol) => blockFromScopedExtract(filterExtractBySymbol(extract, symbol), accountId))
      : [blockFromScopedExtract(extract, accountId)];
  return { blocks, warnings: extract.warnings ?? [] };
}
