import { apiFetch, qs } from "./client";
import type { JournalNote, JournalNoteSymbol } from "./types";

export interface NoteBody {
  type?: JournalNote["type"];
  occurred_at: string;
  title?: string;
  body: string;
  symbols?: JournalNoteSymbol[];
}

export const notesApi = {
  list: (f?: { from?: string; to?: string }) =>
    apiFetch<JournalNote[]>(`/notes${qs((f ?? {}) as Record<string, string | undefined>)}`),
  get: (id: string) => apiFetch<JournalNote>(`/notes/${id}`),
  create: (body: NoteBody) =>
    apiFetch<JournalNote>("/notes", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: NoteBody) =>
    apiFetch<JournalNote>(`/notes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  delete: (id: string) => apiFetch<void>(`/notes/${id}`, { method: "DELETE" }),
};
