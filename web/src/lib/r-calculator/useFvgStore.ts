import { create } from "zustand";
import { persist } from "zustand/middleware";
import { computeFvg, fvgWarnings, type FvgInput, type FvgResult } from "./fvg";
import {
	cloneFvgSession,
	createDefaultFvgSession,
	normalizeFvg,
	type FvgSession,
} from "./fvgSessions";
import type { Warning } from "./calc";

const STORAGE_KEY = "tradermemos/r-calc/fvg/v1";

function genId(): string {
	return `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function derive(session: FvgSession) {
	const input: FvgInput = {
		direction: session.direction,
		zoneTop: session.zoneTop,
		zoneBottom: session.zoneBottom,
		entryAt: session.entryAt,
		entryPrice: session.entryPrice,
		stopBuffer: session.stopBuffer,
		account: session.account,
		riskPct: session.riskPct,
		rMultiple: session.rMultiple,
	};
	const result = computeFvg(input);
	const warns = fvgWarnings(input, result);
	return { input, result, warns };
}

interface FvgState {
	sessions: FvgSession[];
	activeId: string;
	input: FvgInput;
	result: FvgResult;
	warns: Warning[];
	setActive: (id: string) => void;
	addSession: () => void;
	duplicateSession: (id: string) => void;
	removeSession: (id: string) => void;
	renameSession: (id: string, name: string) => void;
	setField: <K extends keyof FvgSession>(key: K, value: FvgSession[K]) => void;
}

function updateActive(
	sessions: FvgSession[],
	activeId: string,
	updater: (s: FvgSession) => FvgSession,
): FvgSession[] {
	return sessions.map((s) => (s.id === activeId ? updater(s) : s));
}

function activeSession(sessions: FvgSession[], activeId: string): FvgSession {
	return sessions.find((s) => s.id === activeId) ?? sessions[0];
}

function withDerived(
	partial: Pick<FvgState, "sessions" | "activeId">,
): Pick<FvgState, "sessions" | "activeId" | "input" | "result" | "warns"> {
	const session = activeSession(partial.sessions, partial.activeId);
	const derived = derive(session);
	return { ...partial, ...derived };
}

export const useFvgStore = create<FvgState>()(
	persist(
		(set, get) => {
			const initial = normalizeFvg(null, genId, "FVG 1");
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
					const name = `FVG ${sessions.length + 1}`;
					const next = [...sessions, createDefaultFvgSession(name, id)];
					set(withDerived({ sessions: next, activeId: id }));
				},

				duplicateSession: (id) => {
					const { sessions } = get();
					const src = sessions.find((s) => s.id === id);
					if (!src) return;
					const newId = genId();
					const next = [
						...sessions,
						cloneFvgSession(src, newId, `${src.name} copy`),
					];
					set(withDerived({ sessions: next, activeId: newId }));
				},

				removeSession: (id) => {
					const { sessions, activeId } = get();
					if (sessions.length <= 1) return;
					const idx = sessions.findIndex((s) => s.id === id);
					if (idx < 0) return;
					const next = sessions.filter((s) => s.id !== id);
					const newActive =
						activeId === id ? next[Math.max(0, idx - 1)].id : activeId;
					set(withDerived({ sessions: next, activeId: newActive }));
				},

				renameSession: (id, name) => {
					const { sessions, activeId } = get();
					const next = sessions.map((s) =>
						s.id === id ? { ...s, name } : s,
					);
					set(withDerived({ sessions: next, activeId }));
				},
			};
		},
		{
			name: STORAGE_KEY,
			partialize: (s) => ({ sessions: s.sessions, activeId: s.activeId }),
			onRehydrateStorage: () => (state) => {
				if (!state) return;
				const normalized = normalizeFvg(
					{ sessions: state.sessions, activeId: state.activeId },
					genId,
					"FVG 1",
				);
				const derived = derive(
					activeSession(normalized.sessions, normalized.activeId),
				);
				Object.assign(state, {
					sessions: normalized.sessions,
					activeId: normalized.activeId,
					...derived,
				});
			},
		},
	),
);
