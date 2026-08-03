/**
 * Local CSV / JSON → TradeExtract for the trade-form prefill (no server round
 * trip — the Import wizard covers whole-account files; this fills one form).
 *
 * Accepted shapes:
 *  - JSON: an array of fill objects, or `{ fills | rows | executions: [...] }`.
 *  - CSV: a header row + fill rows; headers match by the aliases below, so
 *    plain exports ("side,qty,price,time") and broker-ish columns both land.
 */

import type { ExtractedFill, TradeExtract } from '@/api/types';
import { t } from '@lingui/core/macro';
import { emptyExtract } from './trade-prefill';

/** Header/key aliases per canonical field, all compared lowercased sans spaces/_. */
const FIELD_ALIASES: Record<string, string[]> = {
  symbol: ['symbol', 'ticker', 'underlying', 'instrument'],
  side: ['side', 'action', 'buysell', 'bs', 'type'],
  quantity: ['quantity', 'qty', 'shares', 'size', 'filledqty', 'filled', 'contracts'],
  price: ['price', 'avgprice', 'fillprice', 'execprice', 'tradeprice', 'averageprice'],
  fees: ['fees', 'fee'],
  commission: ['commission', 'comm', 'commissions'],
  executed_at: [
    'executedat',
    'executed',
    'time',
    'datetime',
    'date',
    'exectime',
    'filledat',
    'filledtime',
    'timestamp',
    'tradedate',
  ],
  instrument_type: ['instrumenttype', 'market', 'assettype', 'assetclass'],
  option_right: ['optionright', 'right', 'putcall', 'callput', 'optiontype'],
  strike: ['strike', 'strikeprice'],
  expiry: ['expiry', 'expiration', 'expirationdate', 'expdate'],
};

function canon(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_./-]+/g, '');
}

function fieldForHeader(header: string): string | null {
  const c = canon(header);
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(c)) return field;
  }
  return null;
}

function parseSide(raw: unknown): 'buy' | 'sell' | '' {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return '';
  if (/^(sell|sld|sale|s|short|sellshort|selltoopen|selltoclose)$/.test(s.replace(/[\s_]/g, '')))
    return 'sell';
  if (/^(buy|bot|b|long|buytoopen|buytoclose|cover)$/.test(s.replace(/[\s_]/g, ''))) return 'buy';
  if (s.includes('sell')) return 'sell';
  if (s.includes('buy')) return 'buy';
  return '';
}

function parseNum(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const n = Number(String(raw ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** One record (JSON object or CSV header→cell map) → an extract row, or null when unusable. */
function rowFromRecord(record: Record<string, unknown>): ExtractedFill | null {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const field = fieldForHeader(key);
    if (field != null && mapped[field] == null) mapped[field] = value;
  }

  const quantity = Math.abs(parseNum(mapped.quantity));
  const price = parseNum(mapped.price);
  if (quantity <= 0 || price <= 0) return null;

  // Signed quantities (negative = sell) beat a missing side column.
  const side = parseSide(mapped.side) || (parseNum(mapped.quantity) < 0 ? 'sell' : 'buy');
  const right = String(mapped.option_right ?? '').trim().toLowerCase();
  const row: ExtractedFill = {
    symbol: String(mapped.symbol ?? '').trim().toUpperCase() || undefined,
    side,
    quantity,
    price,
    fees: parseNum(mapped.fees),
    commission: parseNum(mapped.commission),
    executed_at: String(mapped.executed_at ?? '').trim(),
  };
  if (right.startsWith('c')) row.option_right = 'call';
  else if (right.startsWith('p')) row.option_right = 'put';
  const strike = parseNum(mapped.strike);
  if (strike > 0) row.strike = strike;
  const expiry = String(mapped.expiry ?? '').trim();
  if (expiry) row.expiry = expiry;
  return row;
}

/** Minimal quoted-CSV line splitter (commas inside "..." stay literal). */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

function recordsFromCsv(text: string): Record<string, unknown>[] {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim() !== '');
  if (lines.length < 2) throw new Error(t`CSV needs a header row and at least one fill row.`);
  const headers = splitCsvLine(lines[0]);
  if (!headers.some((h) => fieldForHeader(h) === 'quantity') ||
      !headers.some((h) => fieldForHeader(h) === 'price')) {
    throw new Error(t`CSV headers must include quantity and price columns.`);
  }
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const record: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      record[header] = cells[i] ?? '';
    });
    return record;
  });
}

function recordsFromJson(text: string): Record<string, unknown>[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(t`Not valid JSON.`);
  }
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw != null
      ? ((raw as Record<string, unknown>).fills ??
        (raw as Record<string, unknown>).rows ??
        (raw as Record<string, unknown>).executions)
      : undefined;
  if (!Array.isArray(list)) {
    throw new Error(
      t`JSON must be an array of fills, or an object with a fills/rows/executions array.`,
    );
  }
  return list.filter((item): item is Record<string, unknown> =>
    typeof item === 'object' && item != null,
  );
}

/** Parse a picked file into a TradeExtract, throwing a user-facing Error when unusable. */
export function parseFillFile(name: string, text: string): TradeExtract {
  const isJson = name.toLowerCase().endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[');
  const records = isJson ? recordsFromJson(text) : recordsFromCsv(text);

  const rows: ExtractedFill[] = [];
  let skipped = 0;
  for (const record of records) {
    const row = rowFromRecord(record);
    if (row) rows.push(row);
    else skipped += 1;
  }
  if (rows.length === 0) {
    throw new Error(t`No usable fills found — rows need a positive quantity and price.`);
  }

  const extract = emptyExtract();
  extract.rows = rows;
  extract.confidence = 1;
  if (skipped > 0) extract.warnings.push(t`Skipped ${skipped} row(s) without quantity/price.`);
  return extract;
}
