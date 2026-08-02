/**
 * Trade form domain logic, mirroring the web NewTradeDrawer submit path
 * (web/src/lib/newTradeBlocks.ts + newTradeFormSchema.ts):
 *  - one POST /executions per fill (server regroups automatically),
 *  - journal upsert via PATCH /trades/{id},
 *  - dividend via POST /cash-transactions.
 */

import type { TradeDetail } from '@/api/types';
import {
  buildStructuredJournalNotes,
  gradeFromInt,
  intFromGrade,
  joinEmotionalStates,
  parseEmotionalStates,
  parseJournalNotes,
} from './journal';

export const MARKETS = ['stock', 'option', 'crypto', 'future', 'forex'] as const;
export type Market = (typeof MARKETS)[number];

export interface FillDraft {
  /** Existing execution id when editing — absent for new rows. */
  id?: string;
  /** Stable client key for list rendering. */
  key: string;
  side: 'buy' | 'sell';
  executedAt: Date;
  quantity: string;
  price: string;
  fees: string;
  commission: string;
}

export interface TradeFormValues {
  accountId: string;
  market: Market;
  symbol: string;
  direction: 'long' | 'short';
  /** Blank = let the server resolve (option→100, future→specs, else 1). */
  multiplier: string;
  optionRight: '' | 'call' | 'put';
  optionStrike: string;
  /** YYYY-MM-DD */
  optionExpiry: string;
  target: string;
  stop: string;
  fills: FillDraft[];
  setupIds: string[];
  session: string;
  emotions: string[];
  setupGrade: string;
  executionGrade: string;
  tagIds: string[];
  mistakeIds: string[];
  entryReason: string;
  exitReason: string;
  reviewNotes: string;
  /** Freeform remainder of existing notes, preserved through edits. */
  legacyNotes: string;
  dividendAmount: string;
  dividendDate: Date;
  dividendNote: string;
}

let keySeq = 0;
export function nextFillKey(): string {
  keySeq += 1;
  return `f${keySeq}`;
}

export function emptyFill(side: 'buy' | 'sell'): FillDraft {
  return {
    key: nextFillKey(),
    side,
    executedAt: new Date(),
    quantity: '',
    price: '',
    fees: '',
    commission: '',
  };
}

export function emptyTradeForm(accountId = ''): TradeFormValues {
  return {
    accountId,
    market: 'stock',
    symbol: '',
    direction: 'long',
    multiplier: '',
    optionRight: '',
    optionStrike: '',
    optionExpiry: '',
    target: '',
    stop: '',
    fills: [emptyFill('buy')],
    setupIds: [],
    session: '',
    emotions: [],
    setupGrade: '',
    executionGrade: '',
    tagIds: [],
    mistakeIds: [],
    entryReason: '',
    exitReason: '',
    reviewNotes: '',
    legacyNotes: '',
    dividendAmount: '',
    dividendDate: new Date(),
    dividendNote: '',
  };
}

/** Seed the form from an existing trade for editing. */
export function tradeFormFromDetail(trade: TradeDetail): TradeFormValues {
  const notes = parseJournalNotes(trade.notes);
  const firstFill = trade.fills[0];
  const details = firstFill?.details ?? {};
  const tagIds: string[] = [];
  const mistakeIds: string[] = [];
  for (const tag of trade.tags) {
    (tag.kind === 'mistake' ? mistakeIds : tagIds).push(tag.id);
  }

  return {
    accountId: trade.account_id,
    market: (MARKETS as readonly string[]).includes(trade.instrument_type)
      ? (trade.instrument_type as Market)
      : 'stock',
    symbol: trade.symbol,
    direction: trade.direction,
    multiplier: firstFill && firstFill.multiplier !== 1 ? String(firstFill.multiplier) : '',
    optionRight: details.option_right === 'call' || details.option_right === 'put'
      ? details.option_right
      : '',
    optionStrike: details.strike ?? '',
    optionExpiry: details.expiry ?? '',
    target: trade.target_price != null ? String(trade.target_price) : '',
    stop: trade.stop_price != null ? String(trade.stop_price) : '',
    fills: trade.fills.map((fill) => ({
      id: fill.id,
      key: nextFillKey(),
      side: fill.side === 'sell' ? 'sell' : 'buy',
      executedAt: new Date(fill.executed_at),
      quantity: String(fill.quantity),
      price: String(fill.price),
      fees: fill.fees ? String(fill.fees) : '',
      commission: fill.commission ? String(fill.commission) : '',
    })),
    setupIds: trade.setup_ids.length > 0 ? trade.setup_ids : trade.setup ? [trade.setup.id] : [],
    session: notes.session,
    emotions: parseEmotionalStates(trade.emotional_state),
    setupGrade: gradeFromInt(trade.confidence),
    executionGrade: gradeFromInt(trade.trade_quality),
    tagIds,
    mistakeIds,
    entryReason: notes.entryReason,
    exitReason: notes.exitReason,
    reviewNotes: notes.reviewNotes,
    legacyNotes: notes.legacy,
    dividendAmount: '',
    dividendDate: new Date(),
    dividendNote: '',
  };
}

export function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** A fill counts once qty and price parse > 0 (web executionRowSchema). */
export function isValidFill(fill: FillDraft): boolean {
  const qty = parseAmount(fill.quantity);
  const price = parseAmount(fill.price);
  return qty != null && qty > 0 && price != null && price > 0;
}

/** Effective multiplier the web sends: explicit override, else option 100, else 0 = server resolves. */
export function effectiveMultiplier(values: TradeFormValues): number {
  const override = parseAmount(values.multiplier);
  if (override != null && override > 0) return override;
  if (values.market === 'option') return 100;
  return 0;
}

/** Option contract details map — only for option trades, empties omitted (web buildExecutionDetails). */
export function executionDetails(values: TradeFormValues): Record<string, string> | undefined {
  if (values.market !== 'option') return undefined;
  const details: Record<string, string> = {};
  if (values.optionRight) details.option_right = values.optionRight;
  if (values.optionStrike.trim()) details.strike = values.optionStrike.trim();
  if (values.optionExpiry.trim()) details.expiry = values.optionExpiry.trim();
  return Object.keys(details).length > 0 ? details : undefined;
}

/** POST /executions body for one fill. */
export function executionBody(values: TradeFormValues, fill: FillDraft): Record<string, unknown> {
  return {
    account_id: values.accountId,
    symbol: values.symbol.trim().toUpperCase(),
    instrument_type: values.market,
    side: fill.side,
    quantity: parseAmount(fill.quantity) ?? 0,
    price: parseAmount(fill.price) ?? 0,
    fees: parseAmount(fill.fees) ?? 0,
    commission: parseAmount(fill.commission) ?? 0,
    executed_at: fill.executedAt.toISOString(),
    multiplier: effectiveMultiplier(values),
    ...(executionDetails(values) ? { details: executionDetails(values) } : {}),
  };
}

/** PATCH /executions/{id} body — only these fields are patchable server-side. */
export function executionPatchBody(fill: FillDraft): Record<string, unknown> {
  return {
    side: fill.side,
    quantity: parseAmount(fill.quantity) ?? 0,
    price: parseAmount(fill.price) ?? 0,
    fees: parseAmount(fill.fees) ?? 0,
    // Omitting commission writes 0 server-side — always send it.
    commission: parseAmount(fill.commission) ?? 0,
    executed_at: fill.executedAt.toISOString(),
  };
}

/** Web computeInitialRisk: per-unit stop distance × qty × multiplier, null when not derivable. */
export function computeInitialRisk(values: TradeFormValues): number | null {
  const stop = parseAmount(values.stop);
  if (stop == null) return null;
  const opens = values.fills.filter(
    (f) => isValidFill(f) && f.side === (values.direction === 'long' ? 'buy' : 'sell'),
  );
  if (opens.length === 0) return null;
  const qty = opens.reduce((sum, f) => sum + (parseAmount(f.quantity) ?? 0), 0);
  if (qty <= 0) return null;
  const notional = opens.reduce(
    (sum, f) => sum + (parseAmount(f.quantity) ?? 0) * (parseAmount(f.price) ?? 0),
    0,
  );
  const entry = notional / qty;
  const perUnit = values.direction === 'long' ? entry - stop : stop - entry;
  if (perUnit <= 0) return null;
  const mult = effectiveMultiplier(values) || 1;
  return perUnit * qty * mult;
}

/** PATCH /trades/{id} journal body (tag_ids replaces the full set, mistakes included). */
export function journalPatchBody(values: TradeFormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {
    notes: buildStructuredJournalNotes({
      session: values.session,
      entryReason: values.entryReason,
      exitReason: values.exitReason,
      reviewNotes: values.reviewNotes,
      legacy: values.legacyNotes,
    }),
    setup_id: values.setupIds[0] ?? '',
    setup_ids: values.setupIds,
    emotional_state: joinEmotionalStates(values.emotions),
    confidence: intFromGrade(values.setupGrade) ?? 0,
    trade_quality: intFromGrade(values.executionGrade) ?? 0,
    tag_ids: [...values.tagIds, ...values.mistakeIds],
  };
  const target = parseAmount(values.target);
  if (target != null) body.target_price = target;
  const stop = parseAmount(values.stop);
  if (stop != null) body.stop_price = stop;
  const risk = computeInitialRisk(values);
  if (risk != null) body.initial_risk = risk;
  return body;
}

/** POST /cash-transactions body, or null when no dividend was entered. */
export function dividendBody(
  values: TradeFormValues,
  tradeId: string,
  currency: string,
): Record<string, unknown> | null {
  const amount = parseAmount(values.dividendAmount);
  if (amount == null || amount <= 0) return null;
  const occurred = new Date(values.dividendDate);
  occurred.setHours(12, 0, 0, 0); // local noon, like the web — avoids day-shift across zones
  return {
    account_id: values.accountId,
    type: 'dividend',
    amount: values.direction === 'short' ? -amount : amount,
    currency,
    occurred_at: occurred.toISOString(),
    note: values.dividendNote.trim() || `${values.symbol.trim().toUpperCase()} dividend`,
    trade_id: tradeId,
  };
}

/** First blocking problem with the form, or null when submittable. */
export function validateTradeForm(values: TradeFormValues): 'symbol' | 'fills' | 'account' | null {
  if (!values.accountId) return 'account';
  if (!values.symbol.trim()) return 'symbol';
  if (!values.fills.some(isValidFill)) return 'fills';
  return null;
}
