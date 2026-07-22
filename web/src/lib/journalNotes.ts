import type { TradeSession } from "./tradeGrades";
import { TRADE_SESSIONS } from "./tradeGrades";

const SECTION_ENTRY = "Entry reason";
const SECTION_EXIT = "Exit reason";
const SECTION_REVIEW = "Review notes";
const SECTION_SESSION = "Session";

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
    `(?:^|\\n)##\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`,
    "i",
  );
  const m = re.exec(src);
  if (!m) return { body: "", rest: src };
  const body = m[1].trim();
  const rest = `${src.slice(0, m.index)}${src.slice(m.index + m[0].length)}`.trim();
  return { body, rest };
}

/** Parse structured markdown sections; falls back to legacy freeform notes. */
export function parseJournalNotes(raw: string): StructuredJournalNotes {
  let rest = (raw ?? "").trim();
  if (!rest) {
    return { session: "", entryReason: "", exitReason: "", reviewNotes: "", legacy: "" };
  }

  const hasSections = /^##\s+/m.test(rest);
  if (!hasSections) {
    return { session: "", entryReason: "", exitReason: "", reviewNotes: "", legacy: rest };
  }

  let session = "";
  let entryReason = "";
  let exitReason = "";
  let reviewNotes = "";

  ({ body: session, rest } = extractSection(rest, SECTION_SESSION));
  ({ body: entryReason, rest } = extractSection(rest, SECTION_ENTRY));
  ({ body: exitReason, rest } = extractSection(rest, SECTION_EXIT));
  ({ body: reviewNotes, rest } = extractSection(rest, SECTION_REVIEW));

  if (session && !(TRADE_SESSIONS as readonly string[]).includes(session)) {
    // keep free text if user edited
  }

  return {
    session,
    entryReason,
    exitReason,
    reviewNotes,
    legacy: rest.trim(),
  };
}

export function buildStructuredJournalNotes(parts: {
  session?: string;
  entryReason?: string;
  exitReason?: string;
  reviewNotes?: string;
  legacy?: string;
}): string {
  const chunks: string[] = [];
  const session = parts.session?.trim();
  const entry = parts.entryReason?.trim();
  const exit = parts.exitReason?.trim();
  const review = parts.reviewNotes?.trim();
  const legacy = parts.legacy?.trim();

  if (session) chunks.push(`## ${SECTION_SESSION}\n${session}`);
  if (entry) chunks.push(`## ${SECTION_ENTRY}\n${entry}`);
  if (exit) chunks.push(`## ${SECTION_EXIT}\n${exit}`);
  if (review) chunks.push(`## ${SECTION_REVIEW}\n${review}`);
  if (legacy) chunks.push(legacy);

  return chunks.join("\n\n").trim();
}

export function isTradeSession(value: string): value is TradeSession {
  return (TRADE_SESSIONS as readonly string[]).includes(value);
}
