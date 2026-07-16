import { z } from "zod";
import { parseAmountToNumber } from "./amountInput";
import { CUSTOM_PRESET_ID } from "./futuresPresets";
import type { TradeGrade } from "./tradeGrades";

export interface ExecutionRow {
  side: "buy" | "sell";
  executed_at: string;
  quantity: string;
  price: string;
  fees: string;
  commission: string;
}

export interface NewTradeFormValues {
  accountId: string;
  copyAccountIds: string[];
  market: string;
  futuresPresetId: string;
  symbol: string;
  side: "long" | "short";
  target: string;
  stop: string;
  rows: ExecutionRow[];
  setupIds: string[];
  session: string;
  emotionalState: string;
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

export function emptyExecutionRow(side: "buy" | "sell"): ExecutionRow {
  return {
    side,
    executed_at: nowLocalDatetime(),
    quantity: "",
    price: "",
    fees: "",
    commission: "",
  };
}

export function defaultNewTradeFormValues(): NewTradeFormValues {
  return {
    accountId: "",
    copyAccountIds: [],
    market: "stock",
    futuresPresetId: CUSTOM_PRESET_ID,
    symbol: "",
    side: "long",
    target: "",
    stop: "",
    rows: [emptyExecutionRow("buy")],
    setupIds: [],
    session: "",
    emotionalState: "",
    setupGrade: "",
    executionGrade: "",
    selectedTagIds: [],
    selectedMistakeIds: [],
    entryReason: "",
    exitReason: "",
    reviewNotes: "",
    dividendAmount: "",
    dividendDate: todayDate(),
    dividendNote: "",
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
