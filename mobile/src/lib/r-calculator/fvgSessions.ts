/**
 * FVG session collection — pure, framework-free. Mirrors sessions.ts but for the
 * FVG sizing inputs. The reactive store (fvgStore.tsx) wires these into Solid.
 */
import type { FvgInput } from "./fvg";
import { pageSymbol } from "./sessions";

export interface FvgSession extends FvgInput {
  id: string;
  /** Ticker the gap sits on — labels its page. Empty until you type one. */
  symbol: string;
}

export interface PersistedFvg {
  sessions: FvgSession[];
  activeId: string;
}

/** Per-session field defaults (everything but identity). */
export const FVG_DEFAULTS: FvgInput = {
  direction: "long",
  zoneTop: 100.5,
  zoneBottom: 100.0,
  entryAt: "top",
  entryPrice: 100.25,
  stopBuffer: 0,
  account: 1000,
  riskPct: 1,
  rMultiple: 2,
};

const FIELD_KEYS = Object.keys(FVG_DEFAULTS) as (keyof FvgInput)[];

function fromPartial(src: Record<string, unknown>, id: string, symbol: string): FvgSession {
  const out = { ...structuredClone(FVG_DEFAULTS), id, symbol } as FvgSession;
  for (const k of FIELD_KEYS) {
    if (src[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = src[k];
  }
  return out;
}

export function createDefaultFvgSession(id: string, symbol = ""): FvgSession {
  return { ...structuredClone(FVG_DEFAULTS), id, symbol };
}

export function cloneFvgSession(src: FvgSession, id: string, symbol: string): FvgSession {
  return { ...structuredClone(src), id, symbol };
}

export function normalizeFvg(parsed: unknown, nextId: () => string): PersistedFvg {
  const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const raw = Array.isArray(obj.sessions) ? obj.sessions : [];
  let sessions = raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => {
      const id = typeof s.id === "string" && s.id ? s.id : nextId();
      return fromPartial(s, id, pageSymbol(s));
    });
  if (sessions.length === 0) sessions = [createDefaultFvgSession(nextId())];
  const activeId = sessions.some((s) => s.id === obj.activeId)
    ? (obj.activeId as string)
    : sessions[0].id;
  return { sessions, activeId };
}
