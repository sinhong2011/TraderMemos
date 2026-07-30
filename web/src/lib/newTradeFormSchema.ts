import { z } from "zod";
import { parseAmountToNumber } from "./amountInput";
import { CUSTOM_PRESET_ID } from "./futuresPresets";
import type { TradeGrade } from "./tradeGrades";

export interface ExecutionRow {
  /** Existing fill id when editing a trade — omitted for new rows. */
  id?: string;
  /**
   * Stable client key for list rendering, like `SymbolTradeBlock.key`. Index
   * keys would hand a removed row's exit animation to its neighbour.
   */
  key?: string;
  side: "buy" | "sell";
  executed_at: string;
  quantity: string;
  price: string;
  fees: string;
  commission: string;
  /** Option contract — used when market is option. */
  option_right: "" | "call" | "put";
  strike: string;
  expiry: string;
}

/** One ticker + its buy/sell fills — several of these can live in one New Trade form. */
export interface SymbolTradeBlock {
  /** Stable client key for list rendering. */
  key: string;
  market: string;
  futuresPresetId: string;
  multiplier: string;
  option_right: "" | "call" | "put";
  option_strike: string;
  option_expiry: string;
  symbol: string;
  side: "long" | "short";
  target: string;
  stop: string;
  rows: ExecutionRow[];
  /** Per-symbol journal */
  setupIds: string[];
  session: string;
  /** Multi-select; serialized comma-joined into the `emotional_state` column. */
  emotionalStates: string[];
  setupGrade: TradeGrade | "";
  executionGrade: TradeGrade | "";
  selectedTagIds: string[];
  selectedMistakeIds: string[];
  entryReason: string;
  exitReason: string;
  reviewNotes: string;
  dividendAmount: string;
  dividendDate: string;
  dividendNote: string;
}

export interface NewTradeFormValues {
  accountId: string;
  copyAccountIds: string[];
  trades: SymbolTradeBlock[];
}

function todayDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nowLocalDatetime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

let tradeKeySeq = 0;
export function nextTradeBlockKey(): string {
  tradeKeySeq += 1;
  return `t${tradeKeySeq}-${Date.now().toString(36)}`;
}

let rowKeySeq = 0;

export function nextExecutionRowKey(): string {
  rowKeySeq += 1;
  return `r${rowKeySeq}-${Date.now().toString(36)}`;
}

export function emptyExecutionRow(
  side: "buy" | "sell",
  optionDefaults?: Partial<Pick<ExecutionRow, "option_right" | "strike" | "expiry">>,
): ExecutionRow {
  return {
    key: nextExecutionRowKey(),
    side,
    executed_at: nowLocalDatetime(),
    quantity: "",
    price: "",
    fees: "",
    commission: "",
    option_right: optionDefaults?.option_right ?? "",
    strike: optionDefaults?.strike ?? "",
    expiry: optionDefaults?.expiry ?? "",
  };
}

export function emptySymbolTrade(
  partial?: Partial<Omit<SymbolTradeBlock, "key" | "rows">> & { rows?: ExecutionRow[] },
): SymbolTradeBlock {
  const side = partial?.side ?? "long";
  return {
    key: nextTradeBlockKey(),
    market: partial?.market ?? "stock",
    futuresPresetId: partial?.futuresPresetId ?? CUSTOM_PRESET_ID,
    multiplier: partial?.multiplier ?? "1",
    option_right: partial?.option_right ?? "",
    option_strike: partial?.option_strike ?? "",
    option_expiry: partial?.option_expiry ?? "",
    symbol: partial?.symbol ?? "",
    side,
    target: partial?.target ?? "",
    stop: partial?.stop ?? "",
    rows: partial?.rows ?? [emptyExecutionRow(side === "long" ? "buy" : "sell")],
    setupIds: partial?.setupIds ?? [],
    session: partial?.session ?? "",
    emotionalStates: partial?.emotionalStates ?? [],
    setupGrade: partial?.setupGrade ?? "",
    executionGrade: partial?.executionGrade ?? "",
    selectedTagIds: partial?.selectedTagIds ?? [],
    selectedMistakeIds: partial?.selectedMistakeIds ?? [],
    entryReason: partial?.entryReason ?? "",
    exitReason: partial?.exitReason ?? "",
    reviewNotes: partial?.reviewNotes ?? "",
    dividendAmount: partial?.dividendAmount ?? "",
    dividendDate: partial?.dividendDate ?? todayDate(),
    dividendNote: partial?.dividendNote ?? "",
  };
}

export function defaultNewTradeFormValues(): NewTradeFormValues {
  return {
    accountId: "",
    copyAccountIds: [],
    trades: [emptySymbolTrade()],
  };
}

export function validateSymbol(value: string): string | undefined {
  if (!value.trim()) return "Symbol is required.";
  return undefined;
}

export function validatePositiveAmount(value: string, label: string): string | undefined {
  const t = value.trim();
  if (!t) return `${label} is required`;
  const n = parseAmountToNumber(t);
  if (n == null || n <= 0) return `${label} must be > 0`;
  return undefined;
}

export function validateNonNegativeAmount(value: string, label: string): string | undefined {
  const t = value.trim();
  if (!t) return undefined;
  const n = parseAmountToNumber(t);
  if (n == null || n < 0) return `${label} must be ≥ 0`;
  return undefined;
}

const positiveAmount = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .superRefine((s, ctx) => {
      const n = parseAmountToNumber(s);
      if (n == null || n <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be > 0` });
      }
    })
    .transform((s) => parseAmountToNumber(s)!);

const nonNegativeAmount = (label: string) =>
  z
    .string()
    .trim()
    .superRefine((s, ctx) => {
      if (!s) return;
      const n = parseAmountToNumber(s);
      if (n == null || n < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be ≥ 0` });
      }
    })
    .transform((s) => (s ? parseAmountToNumber(s)! : 0));

export const executionRowSchema = z.object({
  side: z.enum(["buy", "sell"]),
  executed_at: z.string().min(1),
  quantity: positiveAmount("qty"),
  price: positiveAmount("price"),
  fees: nonNegativeAmount("fees"),
  commission: nonNegativeAmount("commission"),
  option_right: z.enum(["", "call", "put"]).optional().default(""),
  strike: z.string().optional().default(""),
  expiry: z.string().optional().default(""),
});

export type ParsedExecutionRow = z.infer<typeof executionRowSchema>;

export function parseTradeRows(rows: ExecutionRow[]): ParsedExecutionRow[] {
  const out: ParsedExecutionRow[] = [];
  for (const r of rows) {
    const p = executionRowSchema.safeParse(r);
    if (p.success) out.push(p.data);
  }
  return out;
}

export function validateTradeRows(rows: ExecutionRow[]): string | undefined {
  if (parseTradeRows(rows).length > 0) return undefined;
  return "Add at least one valid execution row.";
}

/** At least one symbol block with a ticker and ≥1 valid fill. */
export function validateSymbolTrades(trades: SymbolTradeBlock[]): string | undefined {
  if (!trades.length) return "Add at least one symbol.";
  let anyValid = false;
  for (const t of trades) {
    if (!t.symbol.trim()) continue;
    if (parseTradeRows(t.rows).length > 0) anyValid = true;
  }
  if (!anyValid) {
    if (trades.some((t) => !t.symbol.trim())) return "Symbol is required.";
    return "Add at least one valid execution row.";
  }
  for (const t of trades) {
    if (t.symbol.trim() && parseTradeRows(t.rows).length === 0) {
      return `${t.symbol.toUpperCase()}: add at least one valid execution.`;
    }
    if (!t.symbol.trim() && parseTradeRows(t.rows).length > 0) {
      return "Symbol is required.";
    }
  }
  return undefined;
}
