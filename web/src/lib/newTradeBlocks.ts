/** Build / flatten multi-symbol New Trade blocks. */

import type { TradeExtract } from "./api/ocr";
import type { TradeDetail } from "./api/types";
import {
  emptyExecutionRow,
  emptySymbolTrade,
  executionRowSchema,
  parseTradeRows,
  type ExecutionRow,
  type SymbolTradeBlock,
} from "./newTradeFormSchema";
import { CUSTOM_PRESET_ID, multiplierForPreset, presetIdForSymbol } from "./futuresPresets";
import { parseJournalNotes } from "./journalNotes";
import {
  optionContractFromDetails,
  optionContractFromFills,
  parseExecutionDetails,
} from "./optionContract";
import { buildExecutionDetails } from "./optionStrategy";
import { parseAmountToNumber } from "./amountInput";
import { defaultOcrSymbol, filterOcrExtractBySymbol, groupOcrBySymbol } from "./ocrSymbolGroups";
import { gradeFromInt } from "./tradeGrades";

function toDatetimeLocal(iso: string): string {
  if (!iso.trim()) return new Date().toISOString().slice(0, 19);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 19);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatNumField(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "";
  return String(n);
}

/** Map a scoped OCR extract into chronological editable execution rows. */
export function rowsFromOcrExtract(
  extract: TradeExtract,
  fallbackSide: "long" | "short",
): ExecutionRow[] {
  if (!extract.rows?.length) {
    return [emptyExecutionRow(fallbackSide === "long" ? "buy" : "sell")];
  }
  return [...extract.rows]
    .sort((a, b) => (a.executed_at ?? "").localeCompare(b.executed_at ?? ""))
    .map((r) => ({
      side: r.side === "sell" ? "sell" : "buy",
      executed_at: toDatetimeLocal(r.executed_at ?? ""),
      quantity: r.quantity > 0 ? String(r.quantity) : "",
      price: r.price > 0 ? String(r.price) : "",
      fees: formatNumField((Number(r.fees) || 0) + (Number(r.commission) || 0)),
      commission: "",
      option_right: r.option_right === "put" || r.option_right === "call" ? r.option_right : "",
      strike: r.strike && r.strike > 0 ? String(r.strike) : "",
      expiry: r.expiry?.trim() || "",
    }));
}

export function blockMultiplier(block: SymbolTradeBlock): number {
  if (block.market === "future" || block.market === "futures") {
    return multiplierForPreset(block.futuresPresetId);
  }
  const n = parseAmountToNumber(block.multiplier);
  if (n != null && n > 0) return n;
  return block.market === "option" ? 100 : 1;
}

export type FlatExecutionRow = {
  /** Existing fill id when editing — omit when creating. */
  id?: string;
  symbol: string;
  instrument_type: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  commission: number;
  executed_at: string;
  multiplier: number;
  details?: Record<string, string>;
};

/** Flatten every symbol block into API execution bodies (backend splits trades by symbol). */
export function flattenSymbolTradesToExecutions(trades: SymbolTradeBlock[]): FlatExecutionRow[] {
  const out: FlatExecutionRow[] = [];
  for (const block of trades) {
    const sym = block.symbol.trim().toUpperCase();
    if (!sym) continue;
    const parsed = parseTradeRows(block.rows);
    if (!parsed.length) continue;
    const sources = block.rows.filter((row) => executionRowSchema.safeParse(row).success);
    const multiplier = blockMultiplier(block);
    parsed.forEach((r, idx) => {
      const src = sources[idx];
      const details =
        block.market === "option"
          ? buildExecutionDetails({
              option_right: block.option_right || src?.option_right,
              strike: block.option_strike || src?.strike,
              expiry: block.option_expiry || src?.expiry,
            })
          : undefined;
      out.push({
        id: src?.id,
        symbol: sym,
        instrument_type: block.market,
        side: r.side,
        quantity: r.quantity,
        price: r.price,
        fees: r.fees,
        commission: r.commission,
        executed_at: new Date(r.executed_at).toISOString(),
        multiplier,
        details,
      });
    });
  }
  return out;
}

/** Prefill New Trade drawer from an existing trade detail (edit mode). */
export function symbolTradeFromDetail(trade: TradeDetail): SymbolTradeBlock {
  const side = trade.direction === "short" ? "short" : "long";
  const market = trade.instrument_type || "stock";
  const journal = parseJournalNotes(trade.notes ?? "");
  const contract = optionContractFromFills(trade.fills);
  const right =
    contract?.option_right === "put" || contract?.option_right === "call"
      ? contract.option_right
      : market === "option"
        ? "call"
        : "";
  const fillMult = trade.fills.find((f) => f.multiplier > 0)?.multiplier;
  const multiplier =
    fillMult && fillMult > 0
      ? String(fillMult)
      : market === "option"
        ? "100"
        : market === "future" || market === "futures"
          ? String(multiplierForPreset(presetIdForSymbol(trade.symbol)))
          : "1";
  const setupIds =
    trade.setup_ids && trade.setup_ids.length > 0
      ? trade.setup_ids
      : trade.setup?.id
        ? [trade.setup.id]
        : [];
  const tags = trade.tags ?? [];
  const fills = [...trade.fills].sort((a, b) => a.executed_at.localeCompare(b.executed_at));
  const rows: ExecutionRow[] =
    fills.length > 0
      ? fills.map((f) => {
          const d = optionContractFromDetails(parseExecutionDetails(f.details));
          return {
            id: f.id,
            side: f.side === "sell" ? "sell" : "buy",
            executed_at: toDatetimeLocal(f.executed_at),
            quantity: f.quantity > 0 ? String(f.quantity) : "",
            price: f.price > 0 ? String(f.price) : "",
            fees: formatNumField(f.fees),
            commission: formatNumField(f.commission),
            option_right:
              d?.option_right === "put" || d?.option_right === "call" ? d.option_right : right,
            strike: d?.strike ?? contract?.strike ?? "",
            expiry: d?.expiry ?? contract?.expiry ?? "",
          };
        })
      : [emptyExecutionRow(side === "long" ? "buy" : "sell")];

  return emptySymbolTrade({
    symbol: trade.symbol,
    side,
    market,
    futuresPresetId:
      market === "future" || market === "futures"
        ? presetIdForSymbol(trade.symbol)
        : CUSTOM_PRESET_ID,
    multiplier,
    option_right: right,
    option_strike: contract?.strike ?? "",
    option_expiry: contract?.expiry ?? "",
    target: trade.target_price != null && trade.target_price > 0 ? String(trade.target_price) : "",
    stop: trade.stop_price != null && trade.stop_price > 0 ? String(trade.stop_price) : "",
    rows,
    setupIds,
    session: journal.session,
    entryReason: journal.entryReason || journal.legacy,
    exitReason: journal.exitReason,
    reviewNotes: journal.reviewNotes,
    emotionalState: trade.emotional_state ?? "",
    setupGrade: gradeFromInt(trade.confidence),
    executionGrade: gradeFromInt(trade.trade_quality),
    selectedTagIds: tags.filter((t) => t.kind !== "mistake").map((t) => t.id),
    selectedMistakeIds: tags.filter((t) => t.kind === "mistake").map((t) => t.id),
  });
}

export function symbolTradeFromOcr(
  extract: TradeExtract,
  symbol: string,
  fallbackSide: "long" | "short" = "long",
): SymbolTradeBlock {
  const scoped = filterOcrExtractBySymbol(extract, symbol);
  const side = scoped.side === "short" || scoped.side === "long" ? scoped.side : fallbackSide;
  let market = "stock";
  if (scoped.instrument_type === "option") market = "option";
  else if (scoped.instrument_type === "future" || scoped.instrument_type === "futures") {
    market = "future";
  } else if (scoped.instrument_type) {
    market = scoped.instrument_type === "futures" ? "future" : scoped.instrument_type;
  }
  const rows = rowsFromOcrExtract(scoped, side);
  const contract = rows.find((r) => r.option_right || r.strike || r.expiry);
  const right =
    contract?.option_right === "put" || contract?.option_right === "call"
      ? contract.option_right
      : market === "option"
        ? "call"
        : "";
  return emptySymbolTrade({
    symbol: scoped.symbol || symbol,
    side,
    market,
    futuresPresetId:
      market === "future" || market === "futures"
        ? presetIdForSymbol(scoped.symbol || symbol)
        : CUSTOM_PRESET_ID,
    multiplier:
      market === "option"
        ? "100"
        : market === "future"
          ? String(multiplierForPreset(presetIdForSymbol(scoped.symbol || symbol)))
          : "1",
    option_right: right,
    option_strike: contract?.strike ?? "",
    option_expiry: contract?.expiry ?? "",
    rows:
      rows.length > 0
        ? rows.map((r) =>
            market === "option"
              ? {
                  ...r,
                  option_right: right || r.option_right,
                  strike: contract?.strike || r.strike,
                  expiry: contract?.expiry || r.expiry,
                }
              : r,
          )
        : [emptyExecutionRow(side === "long" ? "buy" : "sell")],
  });
}

/** Load every OCR symbol as its own trade block (one form, many tickers). */
export function tradesFromOcrExtract(extract: TradeExtract): SymbolTradeBlock[] {
  const groups = groupOcrBySymbol(extract);
  if (groups.length === 0) {
    const sym = defaultOcrSymbol(extract);
    if (!sym) return [emptySymbolTrade()];
    return [symbolTradeFromOcr(extract, sym)];
  }
  return groups.map((g) => symbolTradeFromOcr(extract, g.symbol));
}

export type { ExecutionRow, SymbolTradeBlock };
