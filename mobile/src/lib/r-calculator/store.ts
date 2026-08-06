/**
 * R-calculator state — the phone port of web's useRCalculatorStore and
 * useFvgStore, kept as two MMKV-persisted stores like the originals. All math
 * stays in the pure engine files; this only owns sessions, the active pick,
 * and derived results.
 *
 * `normalizeV3` / `normalizeFvg` run as the `merge` step rather than at load:
 * they are the schema guard *and* the v1→v3 migration, so a stored blob must
 * pass through them before any component sees it.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { adoptLegacyValue, legacyJSON, mmkvStorage } from '@/storage/zustand-mmkv';
import {
  calc,
  optionWarnings,
  warnings,
  type CalcInput,
  type CalcResult,
  type Warning,
} from './calc';
import {
  computeExitPlan,
  exitWarnings,
  type ExitPlan,
  type ExitPlanResult,
  type ExitTier,
  type TrailerStop,
} from './exit';
import { computeFvg, fvgWarnings, type FvgInput, type FvgResult } from './fvg';
import { createDefaultFvgSession, normalizeFvg, type FvgSession } from './fvgSessions';
import {
  cloneSession,
  createDefaultSession,
  normalizeV3,
  type Session,
} from './sessions';

const CALC_PERSIST_KEY = 'store:r-calc';
const FVG_PERSIST_KEY = 'store:r-calc-fvg';
/** Pre-zustand keys: bare `{ sessions, activeId }` blobs. */
const CALC_KEY = 'r-calc:sessions';
const FVG_KEY = 'r-calc:fvg-sessions';

function genId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ---------------------------------------------------------------------------
// R-multiple calculator
// ---------------------------------------------------------------------------

export type RCalcSnapshot = {
  sessions: Session[];
  activeId: string;
};

/** Everything the engine says about one session. */
export type CalcDerived = {
  input: CalcInput;
  result: CalcResult;
  /** Cash at risk per unit — `r1` for a share, `r1 × contract size` for an option. */
  riskPerUnit: number;
  exitResult: ExitPlanResult;
  warns: Warning[];
  exitWarns: Warning[];
};

function buildCalcInput(session: Session): CalcInput {
  if (session.instrument === 'options') {
    return {
      direction: 'long',
      entry: session.entryPrem,
      stop: session.stopPrem,
      capital: session.capital,
      riskPct: session.riskPct,
      multiplier: session.contractSize,
    };
  }
  return {
    direction: session.direction,
    entry: session.entry,
    stop: session.stop,
    capital: session.capital,
    riskPct: session.riskPct,
    multiplier: 1,
  };
}

/**
 * Pure per-session derivation. Every page of the calculator's pager shows its
 * own numbers, so this runs per rendered session rather than once for the
 * active one — the engine is a handful of arithmetic passes, cheap enough to
 * belong in render.
 */
export function deriveSession(session: Session): CalcDerived {
  const input = buildCalcInput(session);
  const result = calc(input);
  const riskPerUnit = result.r1 * (input.multiplier ?? 1);
  const exitResult = computeExitPlan(session.exitPlan, {
    shares: result.shares,
    riskPerUnit,
    entry: input.entry,
    r1: result.r1,
    direction: input.direction,
    initialRisk: result.realRisk,
  });
  const warns =
    session.instrument === 'options' ? optionWarnings(input, result) : warnings(input, result);
  return {
    input,
    result,
    riskPerUnit,
    exitResult,
    warns,
    exitWarns: exitWarnings(session.exitPlan),
  };
}

function snapshotCalc(sessions: Session[], activeId: string): RCalcSnapshot {
  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];
  return { sessions, activeId: active.id };
}

/** Normalization is the schema guard *and* the migration — v1/v2 blobs are
 *  upgraded here, so it runs on the persisted value as well as on nothing. */
function normalizeCalc(parsed: unknown): RCalcSnapshot {
  const normalized = normalizeV3(parsed, genId);
  return snapshotCalc(normalized.sessions, normalized.activeId);
}

adoptLegacyValue<RCalcSnapshot>(CALC_PERSIST_KEY, [CALC_KEY], () => {
  const parsed = legacyJSON(CALC_KEY);
  return parsed == null ? undefined : normalizeCalc(parsed);
});

const useCalcStore = create<RCalcSnapshot>()(
  persist((): RCalcSnapshot => normalizeCalc(null), {
    name: CALC_PERSIST_KEY,
    storage: mmkvStorage<RCalcSnapshot>(),
    merge: (persisted) => normalizeCalc(persisted),
  }),
);

function calcState(): RCalcSnapshot {
  return useCalcStore.getState();
}

function commitCalc(sessions: Session[], activeId: string) {
  useCalcStore.setState(snapshotCalc(sessions, activeId));
}

/**
 * Edits name a session by id rather than assuming the active one: the pager
 * keeps neighbouring pages mounted and interactive, so a field can commit from
 * a page that is mid-swipe and not yet the active one.
 */
function updateSession(id: string, updater: (s: Session) => Session) {
  const { sessions, activeId } = calcState();
  commitCalc(
    sessions.map((s) => (s.id === id ? updater(s) : s)),
    activeId,
  );
}

export function useRCalc(): RCalcSnapshot {
  return useCalcStore();
}

export const rCalcActions = {
  setActive(id: string) {
    const { sessions } = calcState();
    if (!sessions.some((s) => s.id === id)) return;
    commitCalc(sessions, id);
  },
  setField<K extends keyof Session>(id: string, key: K, value: Session[K]) {
    updateSession(id, (s) => ({ ...s, [key]: value }));
  },
  addSession() {
    const id = genId();
    commitCalc([...calcState().sessions, createDefaultSession(id)], id);
  },
  duplicateSession(id: string) {
    const { sessions } = calcState();
    const src = sessions.find((s) => s.id === id);
    if (!src) return;
    const newId = genId();
    commitCalc([...sessions, cloneSession(src, newId, src.symbol)], newId);
  },
  removeSession(id: string) {
    const { sessions, activeId } = calcState();
    if (sessions.length <= 1) return;
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const next = sessions.filter((s) => s.id !== id);
    commitCalc(next, activeId === id ? next[Math.max(0, idx - 1)].id : activeId);
  },
  setSymbol(id: string, symbol: string) {
    updateSession(id, (s) => ({ ...s, symbol }));
  },
  addTier(id: string) {
    updateSession(id, (s) => {
      const topR = s.exitPlan.tiers.length ? Math.max(...s.exitPlan.tiers.map((t) => t.r)) : 1;
      return {
        ...s,
        exitPlan: { ...s.exitPlan, tiers: [...s.exitPlan.tiers, { r: topR + 1, pct: 0 }] },
      };
    });
  },
  removeTier(id: string, index: number) {
    updateSession(id, (s) => ({
      ...s,
      exitPlan: { ...s.exitPlan, tiers: s.exitPlan.tiers.filter((_, i) => i !== index) },
    }));
  },
  setTier(id: string, index: number, patch: Partial<ExitTier>) {
    updateSession(id, (s) => ({
      ...s,
      exitPlan: {
        ...s.exitPlan,
        tiers: s.exitPlan.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)),
      },
    }));
  },
  setTrailerStop(id: string, stop: TrailerStop) {
    updateSession(id, (s) => ({ ...s, exitPlan: { ...s.exitPlan, trailerStop: stop } }));
  },
  applyExitPreset(id: string, plan: ExitPlan) {
    updateSession(id, (s) => ({ ...s, exitPlan: structuredClone(plan) }));
  },
};

// ---------------------------------------------------------------------------
// FVG calculator
// ---------------------------------------------------------------------------

export type FvgSnapshot = {
  sessions: FvgSession[];
  activeId: string;
};

export type FvgDerived = { result: FvgResult; warns: Warning[] };

/** Pure per-session derivation — see `deriveSession`. */
export function deriveFvgSession(session: FvgSession): FvgDerived {
  const result = computeFvg(session);
  return { result, warns: fvgWarnings(session, result) };
}

function snapshotFvg(sessions: FvgSession[], activeId: string): FvgSnapshot {
  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];
  return { sessions, activeId: active.id };
}

function normalizeFvgState(parsed: unknown): FvgSnapshot {
  const normalized = normalizeFvg(parsed, genId);
  return snapshotFvg(normalized.sessions, normalized.activeId);
}

adoptLegacyValue<FvgSnapshot>(FVG_PERSIST_KEY, [FVG_KEY], () => {
  const parsed = legacyJSON(FVG_KEY);
  return parsed == null ? undefined : normalizeFvgState(parsed);
});

const useFvgStore = create<FvgSnapshot>()(
  persist((): FvgSnapshot => normalizeFvgState(null), {
    name: FVG_PERSIST_KEY,
    storage: mmkvStorage<FvgSnapshot>(),
    merge: (persisted) => normalizeFvgState(persisted),
  }),
);

function fvgState(): FvgSnapshot {
  return useFvgStore.getState();
}

function commitFvg(sessions: FvgSession[], activeId: string) {
  useFvgStore.setState(snapshotFvg(sessions, activeId));
}

export function useFvg(): FvgSnapshot {
  return useFvgStore();
}

export const fvgActions = {
  setActive(id: string) {
    const { sessions } = fvgState();
    if (!sessions.some((s) => s.id === id)) return;
    commitFvg(sessions, id);
  },
  setField<K extends keyof FvgInput>(id: string, key: K, value: FvgInput[K]) {
    const { sessions, activeId } = fvgState();
    commitFvg(
      sessions.map((s) => (s.id === id ? { ...s, [key]: value } : s)),
      activeId,
    );
  },
  addSession() {
    const id = genId();
    commitFvg([...fvgState().sessions, createDefaultFvgSession(id)], id);
  },
  removeSession(id: string) {
    const { sessions, activeId } = fvgState();
    if (sessions.length <= 1) return;
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const next = sessions.filter((s) => s.id !== id);
    commitFvg(next, activeId === id ? next[Math.max(0, idx - 1)].id : activeId);
  },
  setSymbol(id: string, symbol: string) {
    const { sessions, activeId } = fvgState();
    commitFvg(
      sessions.map((s) => (s.id === id ? { ...s, symbol } : s)),
      activeId,
    );
  },
};
