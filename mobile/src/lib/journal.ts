/**
 * Journal helpers ported from web (web/src/lib/journalNotes.ts + tradeGrades.ts).
 * Notes are stored as structured "## Section" markdown; grades map 1–5 ints to letters.
 */

export interface StructuredJournalNotes {
  session: string;
  entryReason: string;
  exitReason: string;
  reviewNotes: string;
  /** Leftover body if the note wasn't in the structured template. */
  legacy: string;
}

function extractSection(src: string, title: string): { body: string; rest: string } {
  const re = new RegExp(
    `(?:^|\\n)##\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`,
    'i',
  );
  const m = re.exec(src);
  if (!m) return { body: '', rest: src };
  const body = m[1].trim();
  const rest = `${src.slice(0, m.index)}${src.slice(m.index + m[0].length)}`.trim();
  return { body, rest };
}

/** Parse structured markdown sections; falls back to legacy freeform notes. */
export function parseJournalNotes(raw: string): StructuredJournalNotes {
  let rest = (raw ?? '').trim();
  if (!rest) {
    return { session: '', entryReason: '', exitReason: '', reviewNotes: '', legacy: '' };
  }

  if (!/^##\s+/m.test(rest)) {
    return { session: '', entryReason: '', exitReason: '', reviewNotes: '', legacy: rest };
  }

  let session = '';
  let entryReason = '';
  let exitReason = '';
  let reviewNotes = '';

  ({ body: session, rest } = extractSection(rest, 'Session'));
  ({ body: entryReason, rest } = extractSection(rest, 'Entry reason'));
  ({ body: exitReason, rest } = extractSection(rest, 'Exit reason'));
  ({ body: reviewNotes, rest } = extractSection(rest, 'Review notes'));

  return { session, entryReason, exitReason, reviewNotes, legacy: rest.trim() };
}

/** Letter grades mapped to the 1–5 journal ints (A+=5 … C=1), '' when unset. */
export function gradeFromInt(n: number | null | undefined): string {
  if (n == null || n < 1 || n > 5) return '';
  return { 5: 'A+', 4: 'A', 3: 'A-', 2: 'B', 1: 'C' }[Math.round(n)] ?? '';
}

export const TRADE_GRADES = ['A+', 'A', 'A-', 'B', 'C'] as const;
export type TradeGrade = (typeof TRADE_GRADES)[number];

export function intFromGrade(grade: string): number | null {
  const map: Record<string, number> = { 'A+': 5, A: 4, 'A-': 3, B: 2, C: 1 };
  return map[grade] ?? null;
}

export const TRADE_SESSIONS = ['Asia', 'London', 'New York AM', 'New York PM'] as const;

export const EMOTIONAL_STATES = [
  'Calm',
  'Focused',
  'Confident',
  'Anxious',
  'Fearful',
  'Greedy',
  'FOMO',
  'Revenge',
  'Bored',
  'Tired',
  'Overconfident',
] as const;

/** `emotional_state` is one free-text column; multi-select stores comma-joined. */
export function parseEmotionalStates(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinEmotionalStates(states: readonly string[]): string {
  return states.join(', ');
}

/** Structured notes builder (web journalNotes.ts) — journal PUT sends this markdown. */
export function buildStructuredJournalNotes(parts: {
  session?: string;
  entryReason?: string;
  exitReason?: string;
  reviewNotes?: string;
  legacy?: string;
}): string {
  const chunks: string[] = [];
  if (parts.session?.trim()) chunks.push(`## Session\n${parts.session.trim()}`);
  if (parts.entryReason?.trim()) chunks.push(`## Entry reason\n${parts.entryReason.trim()}`);
  if (parts.exitReason?.trim()) chunks.push(`## Exit reason\n${parts.exitReason.trim()}`);
  if (parts.reviewNotes?.trim()) chunks.push(`## Review notes\n${parts.reviewNotes.trim()}`);
  if (parts.legacy?.trim()) chunks.push(parts.legacy.trim());
  return chunks.join('\n\n').trim();
}

/** Common futures point-value presets (web futuresPresets.ts). */
export const FUTURES_PRESETS = [
  { id: 'nq', symbol: 'NQ', label: 'NQ ($20/pt)', multiplier: 20 },
  { id: 'es', symbol: 'ES', label: 'ES ($50/pt)', multiplier: 50 },
  { id: 'ym', symbol: 'YM', label: 'YM ($5/pt)', multiplier: 5 },
  { id: 'rty', symbol: 'RTY', label: 'RTY ($5/pt)', multiplier: 5 },
  { id: 'gc', symbol: 'GC', label: 'GC ($100/pt)', multiplier: 100 },
  { id: 'cl', symbol: 'CL', label: 'CL ($1000/pt)', multiplier: 1000 },
] as const;

/** Match a symbol root to a known futures preset multiplier (1 when unknown). */
export function futuresMultiplierForSymbol(symbol: string): number | null {
  const root = symbol.trim().toUpperCase();
  return FUTURES_PRESETS.find((p) => p.symbol === root)?.multiplier ?? null;
}
