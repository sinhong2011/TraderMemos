import type { Execution, JournalTradePreview, TradeDetail } from "./api/types";

export const IMPORT_PREVIEW_EDIT_PREFIX = "import-preview:";

export function isImportPreviewEditId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith(IMPORT_PREVIEW_EDIT_PREFIX));
}

export function importPreviewRowFromEditId(id: string): number {
  return Number(id.slice(IMPORT_PREVIEW_EDIT_PREFIX.length));
}

export function importPreviewEditId(row: number): string {
  return `${IMPORT_PREVIEW_EDIT_PREFIX}${row}`;
}

function normalizeSide(side: string): "long" | "short" {
  const s = side.trim().toLowerCase();
  if (s === "short" || s === "sell") return "short";
  return "long";
}

function normalizeInstrumentType(trade: JournalTradePreview): string {
  const raw = (trade.instrument_type || trade.market || "stock").trim().toLowerCase();
  if (raw === "opt" || raw === "option" || raw === "options") return "option";
  if (raw === "fut" || raw === "future" || raw === "futures") return "future";
  if (raw === "crypto") return "crypto";
  if (raw === "forex" || raw === "fx") return "forex";
  if (raw === "index") return "index";
  return raw || "stock";
}

/** Build a TradeDetail snapshot so NewTradeDrawer can open in edit mode for an import row. */
export function tradeDetailFromJournalPreview(
  trade: JournalTradePreview,
  opts: {
    accountId: string;
    optionRight?: string;
    currency?: string;
  },
): TradeDetail {
  const direction = normalizeSide(trade.side);
  const instrumentType = normalizeInstrumentType(trade);
  const isOption = instrumentType === "option";
  const multiplier = isOption ? 100 : 1;
  const right =
    opts.optionRight === "call" || opts.optionRight === "put"
      ? opts.optionRight
      : trade.option_right === "call" || trade.option_right === "put"
        ? trade.option_right
        : "";
  const details = right ? { option_right: right } : null;
  const entrySide = direction === "long" ? "buy" : "sell";
  const exitSide = direction === "long" ? "sell" : "buy";
  const currency = opts.currency ?? "USD";
  const id = importPreviewEditId(trade.row);

  const entryFill: Execution = {
    id: `${id}:entry`,
    user_id: "",
    account_id: opts.accountId,
    external_id: null,
    symbol: trade.symbol,
    instrument_type: instrumentType,
    side: entrySide,
    quantity: trade.qty,
    price: trade.entry,
    fees: 0,
    commission: 0,
    executed_at: trade.open_date,
    multiplier,
    details,
    import_batch_id: null,
    dedup_hash: `${id}:entry`,
    created_at: trade.open_date,
  };

  const exitFill: Execution = {
    ...entryFill,
    id: `${id}:exit`,
    side: exitSide,
    price: trade.exit,
    executed_at: trade.close_date,
    dedup_hash: `${id}:exit`,
    created_at: trade.close_date,
  };

  const notesParts: string[] = [];
  if (trade.setup?.trim()) notesParts.push(`## Setup\n${trade.setup.trim()}`);
  if (trade.notes?.trim()) notesParts.push(`## Review notes\n${trade.notes.trim()}`);

  return {
    id,
    account_id: opts.accountId,
    symbol: trade.symbol,
    instrument_type: instrumentType,
    direction,
    status: (trade.status || "closed").toLowerCase(),
    opened_at: trade.open_date,
    closed_at: trade.close_date,
    qty_opened: trade.qty,
    qty_remaining: 0,
    avg_entry_price: trade.entry,
    avg_exit_price: trade.exit,
    gross_pnl: trade.return_usd,
    fees_total: 0,
    net_pnl: trade.return_usd,
    pnl_currency: currency,
    return_pct: trade.return_pct ?? null,
    time_in_trade_secs: null,
    notes: notesParts.join("\n\n"),
    tags: [],
    fills: [entryFill, exitFill],
    setup: null,
    setup_ids: [],
    initial_risk: null,
    target_price: trade.target && Number(trade.target) ? Number(trade.target) : null,
    stop_price: trade.stop && Number(trade.stop) ? Number(trade.stop) : null,
    r_multiple: null,
    emotional_state: "",
    confidence: trade.confidence && Number(trade.confidence) ? Number(trade.confidence) : null,
    trade_quality: null,
    mae: null,
    mfe: null,
    post_exit_mae: null,
    post_exit_mfe: null,
    dividend_total: trade.dividends ?? 0,
    total_pnl: trade.return_usd,
    attachments: [],
  };
}
