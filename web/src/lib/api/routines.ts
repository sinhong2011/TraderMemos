import { apiFetch, qs } from "./client";

export type RoutineStage = "pre" | "during" | "post";

/** Go: api.routineItemDTO. Weekdays are 0 (Sunday) … 6. */
export interface RoutineItem {
  id: string;
  title: string;
  stage: RoutineStage;
  weekdays: number[];
  position: number;
  start_day: string;
}

export interface RoutineDayItem extends RoutineItem {
  done: boolean;
}

/** Payload of GET /routines/day/:day. */
export interface RoutineDay {
  day: string;
  items: RoutineDayItem[];
  total: number;
  done: number;
}

export interface RoutineTally {
  total: number;
  done: number;
}

/** Payload of GET /routines/history (Go: api.routineHistoryDTO). */
export interface RoutineHistory {
  from: string;
  to: string;
  days: (RoutineTally & { day: string })[];
  completion_rate: number | null;
  streak: number;
  by_stage: Record<RoutineStage, RoutineTally>;
}

export interface RoutineBody {
  title?: string;
  stage?: RoutineStage;
  weekdays?: number[];
  /** The caller's local day: when a new item starts, or a reschedule takes effect. */
  day?: string;
}

export const routinesApi = {
  list: (day: string) => apiFetch<{ items: RoutineItem[] }>(`/routines${qs({ day })}`),
  create: (body: RoutineBody) =>
    apiFetch<RoutineItem>("/routines", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: RoutineBody) =>
    apiFetch<RoutineItem>(`/routines/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  archive: (id: string, day: string) =>
    apiFetch<void>(`/routines/${id}${qs({ day })}`, { method: "DELETE" }),
  order: (ids: string[]) =>
    apiFetch<void>("/routines/order", { method: "PUT", body: JSON.stringify({ ids }) }),
  day: (day: string) => apiFetch<RoutineDay>(`/routines/day/${day}`),
  check: (day: string, id: string, done: boolean) =>
    apiFetch<RoutineDay>(`/routines/day/${day}/items/${id}`, {
      method: "PUT",
      body: JSON.stringify({ done }),
    }),
  history: (from: string, to: string) =>
    apiFetch<RoutineHistory>(`/routines/history${qs({ from, to })}`),
};
