/**
 * Offline journaling write queue (roadmap #136) — the writes side of offline
 * support. Reads already survive a dead connection through the MMKV query
 * persister; this module lets the *journaling* writes survive one too: note
 * create/update/delete and the quick-journal trade PATCH land in an
 * expo-sqlite outbox when the server is unreachable and replay in order once
 * it answers again.
 *
 * Deliberately scoped to writes that are safe to replay. A note PATCH is a
 * full replace and a note POST that never got a response creates at worst a
 * note the user can see and delete — unlike `POST /executions`, where a replay
 * books a phantom fill (the reason mutations keep TanStack's no-retry default,
 * see `app/_layout.tsx`). Executions, attachments and media uploads therefore
 * never enter this queue.
 *
 * Coalescing keeps the queue one row per object: editing a note that is still
 * waiting to be created rewrites the create row, deleting it cancels the row
 * outright, and a second quick-journal save for the same trade replaces the
 * first. That also means no row ever references another row's result, so the
 * drain needs no id remapping.
 *
 * SQLite is the durability layer; the zustand store mirrors it so screens can
 * overlay pending writes onto server data (`applyPendingNotes`) without
 * touching the database on render.
 */

import type { QueryClient } from '@tanstack/react-query';
import * as SQLite from 'expo-sqlite';
import { Alert } from 'react-native';
import { create } from 'zustand';

import { ApiError, NetworkError, UnauthorizedError, type RequestOptions } from '@/api/client';
import type { Note, NoteBody, PatchTradeRequest } from '@/api/types';
import { t } from '@lingui/core/macro';

export type OutboxOp =
  | { id: number; kind: 'note-create'; localId: string; body: NoteBody; createdAt: string }
  | { id: number; kind: 'note-update'; noteId: string; body: NoteBody; createdAt: string }
  | { id: number; kind: 'note-delete'; noteId: string; createdAt: string }
  | { id: number; kind: 'trade-journal'; tradeId: string; body: PatchTradeRequest; createdAt: string };

/** Queued-note ids wear a prefix no server id can have, so every consumer can
 *  tell "not created yet" from a real record with one string check. */
const LOCAL_ID_PREFIX = 'queued:';

export function isQueuedNoteId(id: string): boolean {
  return id.startsWith(LOCAL_ID_PREFIX);
}

let localSeq = 0;
function nextLocalNoteId(): string {
  localSeq += 1;
  return `${LOCAL_ID_PREFIX}${Date.now().toString(36)}-${localSeq}`;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

type OutboxRow = {
  id: number;
  kind: string;
  target_id: string;
  payload: string;
  created_at: string;
  attempts: number;
};

let dbInstance: SQLite.SQLiteDatabase | null = null;

/** Lazy so simply importing this module never pays the open (or crashes a dev
 *  build that predates the expo-sqlite native module). */
function db(): SQLite.SQLiteDatabase {
  if (dbInstance == null) {
    dbInstance = SQLite.openDatabaseSync('outbox.db');
    dbInstance.execSync(
      `PRAGMA journal_mode = WAL;
       CREATE TABLE IF NOT EXISTS outbox (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         kind TEXT NOT NULL,
         target_id TEXT NOT NULL,
         payload TEXT NOT NULL DEFAULT '',
         created_at TEXT NOT NULL,
         attempts INTEGER NOT NULL DEFAULT 0
       );`,
    );
  }
  return dbInstance;
}

function rowToOp(row: OutboxRow): OutboxOp | null {
  try {
    switch (row.kind) {
      case 'note-create':
        return {
          id: row.id,
          kind: 'note-create',
          localId: row.target_id,
          body: JSON.parse(row.payload) as NoteBody,
          createdAt: row.created_at,
        };
      case 'note-update':
        return {
          id: row.id,
          kind: 'note-update',
          noteId: row.target_id,
          body: JSON.parse(row.payload) as NoteBody,
          createdAt: row.created_at,
        };
      case 'note-delete':
        return { id: row.id, kind: 'note-delete', noteId: row.target_id, createdAt: row.created_at };
      case 'trade-journal':
        return {
          id: row.id,
          kind: 'trade-journal',
          tradeId: row.target_id,
          body: JSON.parse(row.payload) as PatchTradeRequest,
          createdAt: row.created_at,
        };
      default:
        return null;
    }
  } catch {
    // A row this build can't parse would wedge the drain forever — drop it.
    db().runSync('DELETE FROM outbox WHERE id = ?', row.id);
    return null;
  }
}

// ---------------------------------------------------------------------------
// The reactive mirror
// ---------------------------------------------------------------------------

type OutboxState = { ops: OutboxOp[] };

export const useOutboxStore = create<OutboxState>(() => ({ ops: [] }));

let hydrated = false;

function refreshOps() {
  hydrated = true;
  const rows = db().getAllSync<OutboxRow>('SELECT * FROM outbox ORDER BY id');
  useOutboxStore.setState({ ops: rows.map(rowToOp).filter((op) => op != null) });
}

/** First touch after launch — pulls the persisted queue into the store. */
export function ensureOutboxHydrated() {
  if (!hydrated) refreshOps();
}

export function usePendingOps(): OutboxOp[] {
  return useOutboxStore((state) => state.ops);
}

export function usePendingCount(): number {
  return useOutboxStore((state) => state.ops.length);
}

/**
 * Whether a write for this target is already queued. Direct (online) saves
 * must check this first and go through the queue instead: a straight PATCH
 * with a stale row still queued would sync fine — and then the drain would
 * replay the older payload right over it.
 */
export function hasPendingNoteWrite(noteId: string): boolean {
  ensureOutboxHydrated();
  return useOutboxStore
    .getState()
    .ops.some((op) => op.kind === 'note-update' && op.noteId === noteId);
}

export function hasPendingTradeJournal(tradeId: string): boolean {
  ensureOutboxHydrated();
  return useOutboxStore
    .getState()
    .ops.some((op) => op.kind === 'trade-journal' && op.tradeId === tradeId);
}

/** Sign-out drops the queue with the rest of this account's cached journal. */
export function clearOutbox() {
  db().runSync('DELETE FROM outbox');
  refreshOps();
}

// ---------------------------------------------------------------------------
// Enqueue (with coalescing)
// ---------------------------------------------------------------------------

function insertOp(kind: string, targetId: string, payload: unknown): string {
  const createdAt = new Date().toISOString();
  db().runSync(
    'INSERT INTO outbox (kind, target_id, payload, created_at) VALUES (?, ?, ?, ?)',
    kind,
    targetId,
    payload == null ? '' : JSON.stringify(payload),
    createdAt,
  );
  return createdAt;
}

/** Synthesized stand-in for a note the server hasn't seen yet — shaped so the
 *  list, the editor and the checklist can treat it as any other note. */
export function noteFromOp(op: Extract<OutboxOp, { kind: 'note-create' }>): Note {
  return {
    id: op.localId,
    type: op.body.type ?? 'note',
    occurred_at: op.body.occurred_at,
    title: op.body.title ?? '',
    body: op.body.body,
    symbols: op.body.symbols ?? [],
    created_at: op.createdAt,
    updated_at: op.createdAt,
  };
}

export function enqueueNoteCreate(body: NoteBody): Note {
  ensureOutboxHydrated();
  const localId = nextLocalNoteId();
  const createdAt = insertOp('note-create', localId, body);
  refreshOps();
  return noteFromOp({ id: 0, kind: 'note-create', localId, body, createdAt });
}

export function enqueueNoteUpdate(noteId: string, body: NoteBody) {
  ensureOutboxHydrated();
  const payload = JSON.stringify(body);
  if (isQueuedNoteId(noteId)) {
    // Editing a note that is still queued for creation rewrites the create —
    // the server must only ever see the final content, once. If the create
    // row is gone (the note was deleted from another screen while something
    // still held its id — the checklist card's created-note ref), re-insert
    // it: the caller has content in hand, and silently dropping a write is
    // the one thing an outbox must never do.
    const changed = db().runSync(
      "UPDATE outbox SET payload = ? WHERE kind = 'note-create' AND target_id = ?",
      payload,
      noteId,
    ).changes;
    if (changed === 0) insertOp('note-create', noteId, body);
  } else {
    const changed = db().runSync(
      "UPDATE outbox SET payload = ? WHERE kind = 'note-update' AND target_id = ?",
      payload,
      noteId,
    ).changes;
    if (changed === 0) insertOp('note-update', noteId, body);
  }
  refreshOps();
}

export function enqueueNoteDelete(noteId: string) {
  ensureOutboxHydrated();
  if (isQueuedNoteId(noteId)) {
    // The server never saw this note — cancel the create and we're done.
    db().runSync("DELETE FROM outbox WHERE kind = 'note-create' AND target_id = ?", noteId);
  } else {
    // A queued edit of a note now being deleted has nothing left to say.
    db().runSync("DELETE FROM outbox WHERE kind = 'note-update' AND target_id = ?", noteId);
    const existing = db().getFirstSync<{ id: number }>(
      "SELECT id FROM outbox WHERE kind = 'note-delete' AND target_id = ?",
      noteId,
    );
    if (existing == null) insertOp('note-delete', noteId, null);
  }
  refreshOps();
}

export function enqueueTradeJournal(tradeId: string, body: PatchTradeRequest) {
  ensureOutboxHydrated();
  const changed = db().runSync(
    "UPDATE outbox SET payload = ? WHERE kind = 'trade-journal' AND target_id = ?",
    JSON.stringify(body),
    tradeId,
  ).changes;
  if (changed === 0) insertOp('trade-journal', tradeId, body);
  refreshOps();
}

// ---------------------------------------------------------------------------
// Overlaying pending writes onto server data
// ---------------------------------------------------------------------------

/**
 * Server ids of creates that synced while the app kept running, so a screen
 * still holding a `queued:` id (the editor left open across a reconnect) can
 * find where its note went instead of silently dropping the save.
 */
const syncedNoteIds = new Map<string, string>();

export function resolveNoteId(id: string): string {
  return syncedNoteIds.get(id) ?? id;
}

/**
 * The notes a screen should render: server data minus pending deletes, with
 * pending edits applied and pending creates prepended. `range` mirrors the
 * `from`/`to` filter of the query being overlaid so a create outside the
 * window doesn't leak into it.
 */
export function applyPendingNotes(
  notes: Note[] | undefined,
  ops: OutboxOp[],
  range?: { from?: string; to?: string },
): Note[] {
  const base = notes ?? [];
  if (ops.length === 0) return base;

  const deleted = new Set<string>();
  const updates = new Map<string, Extract<OutboxOp, { kind: 'note-update' }>>();
  const creates: Note[] = [];
  for (const op of ops) {
    if (op.kind === 'note-delete') deleted.add(op.noteId);
    else if (op.kind === 'note-update') updates.set(op.noteId, op);
    else if (op.kind === 'note-create') {
      const day = op.body.occurred_at.slice(0, 10);
      const inRange = (!range?.from || day >= range.from) && (!range?.to || day <= range.to);
      if (inRange) creates.push(noteFromOp(op));
    }
  }
  if (deleted.size === 0 && updates.size === 0 && creates.length === 0) return base;

  const merged = base
    .filter((note) => !deleted.has(note.id))
    .map((note) => {
      const update = updates.get(note.id);
      if (update == null) return note;
      return {
        ...note,
        type: update.body.type ?? note.type,
        occurred_at: update.body.occurred_at,
        title: update.body.title ?? '',
        body: update.body.body,
        symbols: update.body.symbols ?? [],
        updated_at: update.createdAt,
      };
    });
  return [...creates, ...merged];
}

/** Ids with a queued create or edit — the list marks these "Waiting to sync". */
export function pendingNoteIds(ops: OutboxOp[]): Set<string> {
  const ids = new Set<string>();
  for (const op of ops) {
    if (op.kind === 'note-create') ids.add(op.localId);
    else if (op.kind === 'note-update') ids.add(op.noteId);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Drain
// ---------------------------------------------------------------------------

export type ApiFn = <T>(path: string, options?: RequestOptions) => Promise<T>;

let drainInFlight: Promise<void> | null = null;

/** Replays the queue in order. Single-flight; safe to call optimistically. */
export function drainOutbox(api: ApiFn, queryClient: QueryClient): Promise<void> {
  drainInFlight ??= drain(api, queryClient).finally(() => {
    drainInFlight = null;
  });
  return drainInFlight;
}

async function drain(api: ApiFn, queryClient: QueryClient): Promise<void> {
  ensureOutboxHydrated();
  const rejected: string[] = [];
  let synced = 0;
  // Cursor, not "first row", so a row kept back for a 5xx can't loop the drain.
  let afterId = 0;

  for (;;) {
    const row = db().getFirstSync<OutboxRow>(
      'SELECT * FROM outbox WHERE id > ? ORDER BY id LIMIT 1',
      afterId,
    );
    if (row == null) break;
    afterId = row.id;
    const op = rowToOp(row);
    if (op == null) continue;

    try {
      await sendOp(api, queryClient, op);
      db().runSync('DELETE FROM outbox WHERE id = ?', op.id);
      synced += 1;
    } catch (err) {
      // Still unreachable (or signed out): stop and wait for the next recovery.
      if (err instanceof NetworkError || err instanceof UnauthorizedError) break;
      if (err instanceof ApiError && err.status < 500) {
        // Deleting something already gone is the outcome the row wanted.
        if (err.status === 404 && op.kind === 'note-delete') {
          db().runSync('DELETE FROM outbox WHERE id = ?', op.id);
          synced += 1;
          continue;
        }
        // The server understood and refused — replaying can't fix it. Drop the
        // row and tell the user plainly; a zombie row would block the queue.
        db().runSync('DELETE FROM outbox WHERE id = ?', op.id);
        rejected.push(`${opLabel(op)} — ${err.message}`);
        continue;
      }
      // 5xx / unexpected: keep the row for the next drain, move on.
      db().runSync('UPDATE outbox SET attempts = attempts + 1 WHERE id = ?', op.id);
    }
  }

  refreshOps();
  if (synced > 0) {
    // Coarse on purpose: notes, trades, tags and every analytics card can have
    // moved — the same blanket call the online quick-journal save makes.
    void queryClient.invalidateQueries();
  }
  if (rejected.length > 0) {
    Alert.alert(t`Some offline changes didn't sync`, rejected.join('\n'));
  }
}

async function sendOp(api: ApiFn, queryClient: QueryClient, op: OutboxOp): Promise<void> {
  switch (op.kind) {
    case 'note-create': {
      const note = await api<Note>('/notes', { method: 'POST', body: op.body });
      syncedNoteIds.set(op.localId, note.id);
      upsertNoteInCaches(queryClient, note, op.localId);
      return;
    }
    case 'note-update': {
      const note = await api<Note>(`/notes/${op.noteId}`, { method: 'PATCH', body: op.body });
      upsertNoteInCaches(queryClient, note);
      return;
    }
    case 'note-delete':
      await api<void>(`/notes/${op.noteId}`, { method: 'DELETE' });
      removeNoteFromCaches(queryClient, op.noteId);
      return;
    case 'trade-journal':
      await api(`/trades/${op.tradeId}`, { method: 'PATCH', body: op.body });
      return;
  }
}

function opLabel(op: OutboxOp): string {
  switch (op.kind) {
    case 'note-create':
    case 'note-update': {
      const title = op.body.title?.trim();
      if (title) return title;
      return op.body.type === 'daily_log' ? t`Daily log` : t`Note`;
    }
    case 'note-delete':
      return t`Note deletion`;
    case 'trade-journal':
      return t`Trade review`;
  }
}

/**
 * Writes a drained note straight into the query caches before the pending
 * overlay for it disappears — without this the note would vanish from the list
 * for the beat between the row syncing and the refetch landing.
 */
function upsertNoteInCaches(queryClient: QueryClient, note: Note, replaceId?: string) {
  const day = note.occurred_at.slice(0, 10);
  for (const [key, cached] of queryClient.getQueriesData<unknown>({ queryKey: ['notes'] })) {
    if (Array.isArray(cached)) {
      const filters = (key[1] ?? {}) as { from?: string; to?: string };
      const inRange = (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to);
      const rest = (cached as Note[]).filter(
        (candidate) => candidate.id !== note.id && candidate.id !== replaceId,
      );
      queryClient.setQueryData(key, inRange ? [note, ...rest] : rest);
    } else if (cached != null && key[1] === note.id) {
      queryClient.setQueryData(key, note);
    }
  }
}

function removeNoteFromCaches(queryClient: QueryClient, noteId: string) {
  for (const [key, cached] of queryClient.getQueriesData<unknown>({ queryKey: ['notes'] })) {
    if (Array.isArray(cached)) {
      queryClient.setQueryData(
        key,
        (cached as Note[]).filter((candidate) => candidate.id !== noteId),
      );
    }
  }
  // The detail cache too, or the coarse invalidate refetches a 404.
  queryClient.removeQueries({ queryKey: ['notes', noteId], exact: true });
}
