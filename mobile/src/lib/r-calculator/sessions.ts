/**
 * Session collection — pure, framework-free logic for multiple independent
 * calculator sessions. The reactive store (store.tsx) wires these transforms
 * into Solid state; everything here is deterministic and unit-tested.
 */
import type { Direction } from "./calc";
import type { ExitPlan } from "./exit";
import { removeSessionById, reorderById } from "./sessionOps";

export type Instrument = "stock" | "options";
export type OptionType = "call" | "put";

export interface Session {
  id: string;
  /** Ticker this position sizes — labels its page. Empty until you type one. */
  symbol: string;
  instrument: Instrument;
  direction: Direction;
  entry: number;
  stop: number;
  optionType: OptionType;
  entryPrem: number;
  stopPrem: number;
  contractSize: number;
  capital: number;
  riskPct: number;
  exitPlan: ExitPlan;
}

export interface PersistedV3 {
  sessions: Session[];
  activeId: string;
}

/** Per-session field defaults (everything but identity). */
export const SESSION_DEFAULTS: Omit<Session, "id" | "symbol"> = {
  instrument: "stock",
  direction: "long",
  entry: 100.35,
  stop: 100.05,
  optionType: "call",
  entryPrem: 2.5,
  stopPrem: 2.0,
  contractSize: 100,
  capital: 1000,
  riskPct: 1,
  exitPlan: { tiers: [{ r: 2, pct: 75 }], trailerStop: { kind: "breakeven" } },
};

/** The known per-session field keys — used to pick only valid fields from
 *  untrusted persisted/legacy blobs. */
const FIELD_KEYS = Object.keys(SESSION_DEFAULTS) as (keyof typeof SESSION_DEFAULTS)[];

/**
 * The names this screen used to generate for you ("Position 3", "FVG 2") before
 * pages labelled themselves from their ticker. They were never typed, so they
 * migrate to empty and the page falls back to its numbered placeholder; a name
 * you actually chose survives as the symbol.
 */
const AUTO_NAME = /^(position|fvg)\s*\d+$/i;

/** Symbol of a persisted session, reading the pre-symbol `name` field. */
export function pageSymbol(src: Record<string, unknown>): string {
  const stored =
    typeof src.symbol === "string" ? src.symbol : typeof src.name === "string" ? src.name : "";
  return AUTO_NAME.test(stored.trim()) ? "" : stored;
}

/** Build a Session from defaults + any subset of valid fields from `src`. */
function fromPartial(src: Record<string, unknown>, id: string, symbol: string): Session {
  const out = { ...structuredClone(SESSION_DEFAULTS), id, symbol } as Session;
  for (const k of FIELD_KEYS) {
    if (src[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = src[k];
  }
  return out;
}

export function createDefaultSession(id: string, symbol = ""): Session {
  return { ...structuredClone(SESSION_DEFAULTS), id, symbol };
}

export function cloneSession(src: Session, id: string, symbol: string): Session {
  return { ...structuredClone(src), id, symbol };
}

export function migrateV2(v2: unknown, id: string): PersistedV3 {
  const src = v2 && typeof v2 === "object" ? (v2 as Record<string, unknown>) : {};
  return { sessions: [fromPartial(src, id, pageSymbol(src))], activeId: id };
}

export function normalizeV3(parsed: unknown, nextId: () => string): PersistedV3 {
  const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const raw = Array.isArray(obj.sessions) ? obj.sessions : [];
  let sessions = raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => {
      const id = typeof s.id === "string" && s.id ? s.id : nextId();
      return fromPartial(s, id, pageSymbol(s));
    });
  if (sessions.length === 0) sessions = [createDefaultSession(nextId())];
  const activeId = sessions.some((s) => s.id === obj.activeId)
    ? (obj.activeId as string)
    : sessions[0].id;
  return { sessions, activeId };
}

export function removeSession(state: PersistedV3, id: string): PersistedV3 {
  return removeSessionById(state, id);
}

/**
 * Move the `fromId` session into the slot occupied by `toId` (drag-to-reorder).
 * Returns the same array reference when nothing moves, so callers can skip the
 * update; never mutates the input.
 */
export function reorderSessions(sessions: Session[], fromId: string, toId: string): Session[] {
  return reorderById(sessions, fromId, toId);
}
