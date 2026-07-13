import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  calc,
  optionWarnings,
  warnings,
  type CalcInput,
  type CalcResult,
  type Direction,
  type Warning,
} from "./calc";
import {
  computeExitPlan,
  exitWarnings,
  type ExitPlan,
  type ExitPlanResult,
  type ExitTier,
  type TrailerStop,
} from "./exit";
import {
  cloneSession,
  createDefaultSession,
  normalizeV3,
  type Instrument,
  type OptionType,
  type Session,
} from "./sessions";

const STORAGE_KEY = "tradermemos/r-calc/v1";

function genId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function buildCalcInput(session: Session): CalcInput {
  if (session.instrument === "options") {
    return {
      direction: "long",
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

function derive(session: Session) {
  const input = buildCalcInput(session);
  const result = calc(input);
  const exitCtx = {
    shares: result.shares,
    riskPerUnit: result.r1 * (input.multiplier ?? 1),
    entry: input.entry,
    r1: result.r1,
    direction: input.direction,
    initialRisk: result.realRisk,
  };
  const exitResult = computeExitPlan(session.exitPlan, exitCtx);
  const warns =
    session.instrument === "options" ? optionWarnings(input, result) : warnings(input, result);
  const exitWarns = exitWarnings(session.exitPlan);
  return { input, result, exitResult, warns, exitWarns };
}

interface RCalculatorState {
  sessions: Session[];
  activeId: string;
  input: CalcInput;
  result: CalcResult;
  exitResult: ExitPlanResult;
  warns: Warning[];
  exitWarns: Warning[];
  setActive: (id: string) => void;
  addSession: () => void;
  duplicateSession: (id: string) => void;
  removeSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  setField: <K extends keyof Session>(key: K, value: Session[K]) => void;
  addTier: () => void;
  removeTier: (index: number) => void;
  setTier: (index: number, patch: Partial<ExitTier>) => void;
  setTrailerStop: (stop: TrailerStop) => void;
  applyExitPreset: (plan: ExitPlan) => void;
}

function updateActive(
  sessions: Session[],
  activeId: string,
  updater: (s: Session) => Session,
): Session[] {
  return sessions.map((s) => (s.id === activeId ? updater(s) : s));
}

function activeSession(sessions: Session[], activeId: string): Session {
  return sessions.find((s) => s.id === activeId) ?? sessions[0];
}

function withDerived(
  partial: Pick<RCalculatorState, "sessions" | "activeId">,
): Pick<
  RCalculatorState,
  "sessions" | "activeId" | "input" | "result" | "exitResult" | "warns" | "exitWarns"
> {
  const session = activeSession(partial.sessions, partial.activeId);
  const derived = derive(session);
  return { ...partial, ...derived };
}

export const useRCalculatorStore = create<RCalculatorState>()(
  persist(
    (set, get) => {
      const initial = normalizeV3(null, genId, "Position 1");
      const derived = derive(initial.sessions[0]);

      return {
        sessions: initial.sessions,
        activeId: initial.activeId,
        ...derived,

        setActive: (id) => {
          const { sessions } = get();
          if (!sessions.some((s) => s.id === id)) return;
          set(withDerived({ sessions, activeId: id }));
        },

        setField: (key, value) => {
          const { sessions, activeId } = get();
          const next = updateActive(sessions, activeId, (s) => ({
            ...s,
            [key]: value,
          }));
          set(withDerived({ sessions: next, activeId }));
        },

        addSession: () => {
          const { sessions } = get();
          const id = genId();
          const name = `Position ${sessions.length + 1}`;
          const next = [...sessions, createDefaultSession(name, id)];
          set(withDerived({ sessions: next, activeId: id }));
        },

        duplicateSession: (id) => {
          const { sessions } = get();
          const src = sessions.find((s) => s.id === id);
          if (!src) return;
          const newId = genId();
          const next = [...sessions, cloneSession(src, newId, `${src.name} copy`)];
          set(withDerived({ sessions: next, activeId: newId }));
        },

        removeSession: (id) => {
          const { sessions, activeId } = get();
          if (sessions.length <= 1) return;
          const idx = sessions.findIndex((s) => s.id === id);
          if (idx < 0) return;
          const next = sessions.filter((s) => s.id !== id);
          const newActive = activeId === id ? next[Math.max(0, idx - 1)].id : activeId;
          set(withDerived({ sessions: next, activeId: newActive }));
        },

        renameSession: (id, name) => {
          const { sessions, activeId } = get();
          const next = sessions.map((s) => (s.id === id ? { ...s, name } : s));
          set(withDerived({ sessions: next, activeId }));
        },

        addTier: () => {
          const { sessions, activeId } = get();
          const next = updateActive(sessions, activeId, (s) => {
            const topR = s.exitPlan.tiers.length
              ? Math.max(...s.exitPlan.tiers.map((t) => t.r))
              : 1;
            return {
              ...s,
              exitPlan: {
                ...s.exitPlan,
                tiers: [...s.exitPlan.tiers, { r: topR + 1, pct: 0 }],
              },
            };
          });
          set(withDerived({ sessions: next, activeId }));
        },

        removeTier: (index) => {
          const { sessions, activeId } = get();
          const next = updateActive(sessions, activeId, (s) => ({
            ...s,
            exitPlan: {
              ...s.exitPlan,
              tiers: s.exitPlan.tiers.filter((_, i) => i !== index),
            },
          }));
          set(withDerived({ sessions: next, activeId }));
        },

        setTier: (index, patch) => {
          const { sessions, activeId } = get();
          const next = updateActive(sessions, activeId, (s) => ({
            ...s,
            exitPlan: {
              ...s.exitPlan,
              tiers: s.exitPlan.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)),
            },
          }));
          set(withDerived({ sessions: next, activeId }));
        },

        setTrailerStop: (stop) => {
          const { sessions, activeId } = get();
          const next = updateActive(sessions, activeId, (s) => ({
            ...s,
            exitPlan: { ...s.exitPlan, trailerStop: stop },
          }));
          set(withDerived({ sessions: next, activeId }));
        },

        applyExitPreset: (plan) => {
          const { sessions, activeId } = get();
          const next = updateActive(sessions, activeId, (s) => ({
            ...s,
            exitPlan: structuredClone(plan),
          }));
          set(withDerived({ sessions: next, activeId }));
        },
      };
    },
    {
      name: STORAGE_KEY,
      partialize: (s) => ({ sessions: s.sessions, activeId: s.activeId }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const normalized = normalizeV3(
          { sessions: state.sessions, activeId: state.activeId },
          genId,
          "Position 1",
        );
        const derived = derive(activeSession(normalized.sessions, normalized.activeId));
        Object.assign(state, {
          sessions: normalized.sessions,
          activeId: normalized.activeId,
          ...derived,
        });
      },
    },
  ),
);

export type { Instrument, OptionType, Direction };
