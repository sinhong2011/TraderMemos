/**
 * R-calculator state — the web zustand stores (useRCalculatorStore /
 * useFvgStore) folded into one MMKV-persisted module store, matching the
 * app-wide useSyncExternalStore pattern (tag-bar.ts). All math stays in the
 * pure engine files; this only owns sessions, the active pick, and derived
 * results.
 */

import { useSyncExternalStore } from 'react';

import { storage } from '@/storage/mmkv';
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

function loadCalc(): RCalcSnapshot {
  let parsed: unknown = null;
  const raw = storage.getString(CALC_KEY);
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  const normalized = normalizeV3(parsed, genId);
  return snapshotCalc(normalized.sessions, normalized.activeId);
}

let calcSnapshot = loadCalc();
const calcListeners = new Set<() => void>();

function commitCalc(sessions: Session[], activeId: string) {
  calcSnapshot = snapshotCalc(sessions, activeId);
  storage.set(CALC_KEY, JSON.stringify({ sessions, activeId: calcSnapshot.activeId }));
  for (const listener of calcListeners) listener();
}

/**
 * Edits name a session by id rather than assuming the active one: the pager
 * keeps neighbouring pages mounted and interactive, so a field can commit from
 * a page that is mid-swipe and not yet the active one.
 */
function updateSession(id: string, updater: (s: Session) => Session) {
  const { sessions, activeId } = calcSnapshot;
  commitCalc(
    sessions.map((s) => (s.id === id ? updater(s) : s)),
    activeId,
  );
}

export function useRCalc(): RCalcSnapshot {
  return useSyncExternalStore(
    (callback) => {
      calcListeners.add(callback);
      return () => calcListeners.delete(callback);
    },
    () => calcSnapshot,
  );
}

export const rCalcActions = {
  setActive(id: string) {
    if (!calcSnapshot.sessions.some((s) => s.id === id)) return;
    commitCalc(calcSnapshot.sessions, id);
  },
  setField<K extends keyof Session>(id: string, key: K, value: Session[K]) {
    updateSession(id, (s) => ({ ...s, [key]: value }));
  },
  addSession() {
    const id = genId();
    commitCalc([...calcSnapshot.sessions, createDefaultSession(id)], id);
  },
  duplicateSession(id: string) {
    const src = calcSnapshot.sessions.find((s) => s.id === id);
    if (!src) return;
    const newId = genId();
    commitCalc([...calcSnapshot.sessions, cloneSession(src, newId, src.symbol)], newId);
  },
  removeSession(id: string) {
    const { sessions, activeId } = calcSnapshot;
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

function loadFvg(): FvgSnapshot {
  let parsed: unknown = null;
  const raw = storage.getString(FVG_KEY);
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  const normalized = normalizeFvg(parsed, genId);
  return snapshotFvg(normalized.sessions, normalized.activeId);
}

let fvgSnapshot = loadFvg();
const fvgListeners = new Set<() => void>();

function commitFvg(sessions: FvgSession[], activeId: string) {
  fvgSnapshot = snapshotFvg(sessions, activeId);
  storage.set(FVG_KEY, JSON.stringify({ sessions, activeId: fvgSnapshot.activeId }));
  for (const listener of fvgListeners) listener();
}

export function useFvg(): FvgSnapshot {
  return useSyncExternalStore(
    (callback) => {
      fvgListeners.add(callback);
      return () => fvgListeners.delete(callback);
    },
    () => fvgSnapshot,
  );
}

export const fvgActions = {
  setActive(id: string) {
    if (!fvgSnapshot.sessions.some((s) => s.id === id)) return;
    commitFvg(fvgSnapshot.sessions, id);
  },
  setField<K extends keyof FvgInput>(id: string, key: K, value: FvgInput[K]) {
    const { sessions, activeId } = fvgSnapshot;
    commitFvg(
      sessions.map((s) => (s.id === id ? { ...s, [key]: value } : s)),
      activeId,
    );
  },
  addSession() {
    const id = genId();
    commitFvg([...fvgSnapshot.sessions, createDefaultFvgSession(id)], id);
  },
  removeSession(id: string) {
    const { sessions, activeId } = fvgSnapshot;
    if (sessions.length <= 1) return;
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const next = sessions.filter((s) => s.id !== id);
    commitFvg(next, activeId === id ? next[Math.max(0, idx - 1)].id : activeId);
  },
  setSymbol(id: string, symbol: string) {
    const { sessions, activeId } = fvgSnapshot;
    commitFvg(
      sessions.map((s) => (s.id === id ? { ...s, symbol } : s)),
      activeId,
    );
  },
};
