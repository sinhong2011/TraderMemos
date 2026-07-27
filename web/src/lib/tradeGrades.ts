/** Letter grades mapped to existing 1–5 journal ints (A+=5 … C=1). */
export const TRADE_GRADES = ["A+", "A", "A-", "B", "C"] as const;
export type TradeGrade = (typeof TRADE_GRADES)[number];

const GRADE_TO_INT: Record<TradeGrade, number> = {
  "A+": 5,
  A: 4,
  "A-": 3,
  B: 2,
  C: 1,
};

const INT_TO_GRADE: Record<number, TradeGrade> = {
  5: "A+",
  4: "A",
  3: "A-",
  2: "B",
  1: "C",
};

export function gradeFromInt(n: number | null | undefined): TradeGrade | "" {
  if (n == null || n < 1 || n > 5) return "";
  return INT_TO_GRADE[Math.round(n)] ?? "";
}

export function intFromGrade(grade: TradeGrade | ""): number | undefined {
  if (!grade) return undefined;
  return GRADE_TO_INT[grade];
}

/** SegmentedControl options (value = grade letter). */
export const GRADE_OPTS = TRADE_GRADES.map((g) => ({ value: g, label: g }));

/** a2ky9-style emotion list (plus a few journal staples). */
export const EMOTIONAL_STATES = [
  "Calm",
  "Focused",
  "Confident",
  "Anxious",
  "Fearful",
  "Greedy",
  "FOMO",
  "Revenge",
  "Bored",
  "Tired",
  "Overconfident",
] as const;

/**
 * `emotional_state` is a single free-text column, so a multi-select is stored
 * comma-joined and split back out on hydrate.
 */
export function parseEmotionalStates(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinEmotionalStates(states: readonly string[]): string {
  return states
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

/** Session labels for journal chips (stored in notes until a real session column exists). */
export const TRADE_SESSIONS = ["Asia", "London", "New York AM", "New York PM"] as const;
export type TradeSession = (typeof TRADE_SESSIONS)[number];
