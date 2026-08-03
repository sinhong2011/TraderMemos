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
  name: string;
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
export const SESSION_DEFAULTS: Omit<Session, "id" | "name"> = {
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

/** Build a Session from defaults + any subset of valid fields from `src`. */
function fromPartial(src: Record<string, unknown>, id: string, name: string): Session {
  const out = { ...structuredClone(SESSION_DEFAULTS), id, name } as Session;
  for (const k of FIELD_KEYS) {
    if (src[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = src[k];
  }
  return out;
}

export function createDefaultSession(name: string, id: string): Session {
  return { ...structuredClone(SESSION_DEFAULTS), id, name };
}

export function cloneSession(src: Session, id: string, name: string): Session {
  return { ...structuredClone(src), id, name };
}

export function migrateV2(v2: unknown, id: string, defaultName: string): PersistedV3 {
  const src = v2 && typeof v2 === "object" ? (v2 as Record<string, unknown>) : {};
  return { sessions: [fromPartial(src, id, defaultName)], activeId: id };
}

export function normalizeV3(
  parsed: unknown,
  nextId: () => string,
  defaultName: string,
): PersistedV3 {
  const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const raw = Array.isArray(obj.sessions) ? obj.sessions : [];
  let sessions = raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => {
      const id = typeof s.id === "string" && s.id ? s.id : nextId();
      const name = typeof s.name === "string" && s.name ? s.name : defaultName;
      return fromPartial(s, id, name);
    });
  if (sessions.length === 0) sessions = [createDefaultSession(defaultName, nextId())];
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
