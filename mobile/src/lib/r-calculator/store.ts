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
  active: Session;
  input: CalcInput;
  result: CalcResult;
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

function deriveCalc(sessions: Session[], activeId: string): RCalcSnapshot {
  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const input = buildCalcInput(active);
  const result = calc(input);
  const exitResult = computeExitPlan(active.exitPlan, {
    shares: result.shares,
    riskPerUnit: result.r1 * (input.multiplier ?? 1),
    entry: input.entry,
    r1: result.r1,
    direction: input.direction,
    initialRisk: result.realRisk,
  });
  const warns =
    active.instrument === 'options' ? optionWarnings(input, result) : warnings(input, result);
  return {
    sessions,
    activeId: active.id,
    active,
    input,
    result,
    exitResult,
    warns,
    exitWarns: exitWarnings(active.exitPlan),
  };
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
  const normalized = normalizeV3(parsed, genId, 'Position 1');
  return deriveCalc(normalized.sessions, normalized.activeId);
}

let calcSnapshot = loadCalc();
const calcListeners = new Set<() => void>();

function commitCalc(sessions: Session[], activeId: string) {
  calcSnapshot = deriveCalc(sessions, activeId);
  storage.set(CALC_KEY, JSON.stringify({ sessions, activeId: calcSnapshot.activeId }));
  for (const listener of calcListeners) listener();
}

function updateActive(updater: (s: Session) => Session) {
  const { sessions, activeId } = calcSnapshot;
  commitCalc(
    sessions.map((s) => (s.id === activeId ? updater(s) : s)),
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
  setField<K extends keyof Session>(key: K, value: Session[K]) {
    updateActive((s) => ({ ...s, [key]: value }));
  },
  addSession() {
    const id = genId();
    const name = `Position ${calcSnapshot.sessions.length + 1}`;
    commitCalc([...calcSnapshot.sessions, createDefaultSession(name, id)], id);
  },
  duplicateSession(id: string) {
    const src = calcSnapshot.sessions.find((s) => s.id === id);
    if (!src) return;
    const newId = genId();
    commitCalc(
      [...calcSnapshot.sessions, cloneSession(src, newId, `${src.name} copy`)],
      newId,
    );
  },
  removeSession(id: string) {
    const { sessions, activeId } = calcSnapshot;
    if (sessions.length <= 1) return;
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const next = sessions.filter((s) => s.id !== id);
    commitCalc(next, activeId === id ? next[Math.max(0, idx - 1)].id : activeId);
  },
  renameSession(id: string, name: string) {
    const { sessions, activeId } = calcSnapshot;
    commitCalc(
      sessions.map((s) => (s.id === id ? { ...s, name } : s)),
      activeId,
    );
  },
  addTier() {
    updateActive((s) => {
      const topR = s.exitPlan.tiers.length ? Math.max(...s.exitPlan.tiers.map((t) => t.r)) : 1;
      return {
        ...s,
        exitPlan: { ...s.exitPlan, tiers: [...s.exitPlan.tiers, { r: topR + 1, pct: 0 }] },
      };
    });
  },
  removeTier(index: number) {
    updateActive((s) => ({
      ...s,
      exitPlan: { ...s.exitPlan, tiers: s.exitPlan.tiers.filter((_, i) => i !== index) },
    }));
  },
  setTier(index: number, patch: Partial<ExitTier>) {
    updateActive((s) => ({
      ...s,
      exitPlan: {
        ...s.exitPlan,
        tiers: s.exitPlan.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)),
      },
    }));
  },
  setTrailerStop(stop: TrailerStop) {
    updateActive((s) => ({ ...s, exitPlan: { ...s.exitPlan, trailerStop: stop } }));
  },
  applyExitPreset(plan: ExitPlan) {
    updateActive((s) => ({ ...s, exitPlan: structuredClone(plan) }));
  },
};

// ---------------------------------------------------------------------------
// FVG calculator
// ---------------------------------------------------------------------------

export type FvgSnapshot = {
  sessions: FvgSession[];
  activeId: string;
  active: FvgSession;
  result: FvgResult;
  warns: Warning[];
};

function deriveFvg(sessions: FvgSession[], activeId: string): FvgSnapshot {
  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const result = computeFvg(active);
  return { sessions, activeId: active.id, active, result, warns: fvgWarnings(active, result) };
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
  const normalized = normalizeFvg(parsed, genId, 'FVG 1');
  return deriveFvg(normalized.sessions, normalized.activeId);
}

let fvgSnapshot = loadFvg();
const fvgListeners = new Set<() => void>();

function commitFvg(sessions: FvgSession[], activeId: string) {
  fvgSnapshot = deriveFvg(sessions, activeId);
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
  setField<K extends keyof FvgInput>(key: K, value: FvgInput[K]) {
    const { sessions, activeId } = fvgSnapshot;
    commitFvg(
      sessions.map((s) => (s.id === activeId ? { ...s, [key]: value } : s)),
      activeId,
    );
  },
  addSession() {
    const id = genId();
    commitFvg(
      [...fvgSnapshot.sessions, createDefaultFvgSession(`FVG ${fvgSnapshot.sessions.length + 1}`, id)],
      id,
    );
  },
  removeSession(id: string) {
    const { sessions, activeId } = fvgSnapshot;
    if (sessions.length <= 1) return;
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const next = sessions.filter((s) => s.id !== id);
    commitFvg(next, activeId === id ? next[Math.max(0, idx - 1)].id : activeId);
  },
};
