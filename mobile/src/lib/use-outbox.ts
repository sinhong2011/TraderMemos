/**
 * React bindings for the offline write queue (`lib/outbox.ts`).
 *
 * The queued-save hooks are the single seam between "save this" and "the
 * server is unreachable": callers ask for a create/update/delete and get told
 * whether it went through or was queued — they never branch on connectivity
 * themselves. When the Pro gate is locked, the hooks behave exactly like the
 * bare API calls they wrap (fail with an alertable error), so the free tier
 * loses the queue, not the save.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { NetworkError } from '@/api/client';
import { useApiRequest } from '@/api/hooks';
import { useSession } from '@/api/session';
import type { Note, NoteBody, PatchTradeRequest } from '@/api/types';
import { useConnectivityStore } from '@/lib/connectivity';
import {
  drainOutbox,
  enqueueNoteCreate,
  enqueueNoteDelete,
  enqueueNoteUpdate,
  enqueueTradeJournal,
  ensureOutboxHydrated,
  hasPendingNoteWrite,
  hasPendingTradeJournal,
  isQueuedNoteId,
  resolveNoteId,
  useOutboxStore,
  usePendingOps,
  type OutboxOp,
} from '@/lib/outbox';
import { useProUnlocked } from '@/lib/pro';

function serverReachable(): boolean {
  return useConnectivityStore.getState().reachable;
}

function outboxEmpty(): boolean {
  return useOutboxStore.getState().ops.length === 0;
}

/**
 * Replays the queue whenever there could be something to replay: on launch,
 * when reachability recovers, and when the app comes back to the foreground
 * (a 5xx can leave rows behind with the server otherwise answering). Mounted
 * once at the root — see `OutboxGate` in `app/_layout.tsx`.
 */
export function useOutboxDrain() {
  const api = useApiRequest();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const recoveredAt = useConnectivityStore((state) => state.recoveredAt);

  useEffect(() => {
    ensureOutboxHydrated();
    if (session == null || !serverReachable() || outboxEmpty()) return;
    void drainOutbox(api, queryClient);
  }, [recoveredAt, session, api, queryClient]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      if (session == null || !serverReachable() || outboxEmpty()) return;
      void drainOutbox(api, queryClient);
    });
    return () => subscription.remove();
  }, [session, api, queryClient]);
}

/**
 * Note writes that queue instead of failing when the server is unreachable.
 *
 * Ids that are still `queued:` locals always route to the outbox — the server
 * has nothing to PATCH — unless their create already synced this session, in
 * which case `resolveNoteId` follows the note to its server id.
 */
export function useQueuedNoteOps() {
  const api = useApiRequest();
  const queryClient = useQueryClient();
  const unlocked = useProUnlocked('offlineQueue');

  // An enqueue that happens while the server is answering (an edit to a note
  // whose create is still queued) should sync right away, not wait for the
  // next reachability transition.
  const drainSoon = () => {
    if (serverReachable() && !outboxEmpty()) void drainOutbox(api, queryClient);
  };

  const createNote = async (body: NoteBody): Promise<{ note: Note; queued: boolean }> => {
    if (unlocked && !serverReachable()) return { note: enqueueNoteCreate(body), queued: true };
    try {
      return { note: await api<Note>('/notes', { method: 'POST', body }), queued: false };
    } catch (err) {
      if (unlocked && err instanceof NetworkError) {
        return { note: enqueueNoteCreate(body), queued: true };
      }
      throw err;
    }
  };

  const updateNote = async (id: string, body: NoteBody): Promise<{ queued: boolean }> => {
    const target = resolveNoteId(id);
    // A target with a write already queued must stay behind it: a direct PATCH
    // here would land first and then be overwritten when the stale row drains.
    if (isQueuedNoteId(target) || hasPendingNoteWrite(target)) {
      enqueueNoteUpdate(target, body);
      drainSoon();
      return { queued: true };
    }
    if (unlocked && !serverReachable()) {
      enqueueNoteUpdate(target, body);
      return { queued: true };
    }
    try {
      // PATCH is a full replace on this endpoint — callers send every field.
      await api(`/notes/${target}`, { method: 'PATCH', body });
      return { queued: false };
    } catch (err) {
      if (unlocked && err instanceof NetworkError) {
        enqueueNoteUpdate(target, body);
        return { queued: true };
      }
      throw err;
    }
  };

  const deleteNote = async (id: string): Promise<{ queued: boolean }> => {
    const target = resolveNoteId(id);
    // Same ordering rule as updateNote: a queued edit for this note has to be
    // superseded in the queue, not raced by a direct DELETE.
    if (isQueuedNoteId(target) || hasPendingNoteWrite(target)) {
      enqueueNoteDelete(target);
      drainSoon();
      return { queued: true };
    }
    if (unlocked && !serverReachable()) {
      enqueueNoteDelete(target);
      return { queued: true };
    }
    try {
      await api<void>(`/notes/${target}`, { method: 'DELETE' });
      return { queued: false };
    } catch (err) {
      if (unlocked && err instanceof NetworkError) {
        enqueueNoteDelete(target);
        return { queued: true };
      }
      throw err;
    }
  };

  return { createNote, updateNote, deleteNote };
}

/** The quick-journal PATCH, queueable — one pending review per trade. */
export function useQueuedTradeJournal() {
  const api = useApiRequest();
  const queryClient = useQueryClient();
  const unlocked = useProUnlocked('offlineQueue');

  const saveJournal = async (
    tradeId: string,
    body: PatchTradeRequest,
  ): Promise<{ queued: boolean }> => {
    // A review already queued for this trade must be superseded in the queue —
    // a direct PATCH would sync and then be overwritten by the stale row.
    if (hasPendingTradeJournal(tradeId)) {
      enqueueTradeJournal(tradeId, body);
      if (serverReachable()) void drainOutbox(api, queryClient);
      return { queued: true };
    }
    if (unlocked && !serverReachable()) {
      enqueueTradeJournal(tradeId, body);
      return { queued: true };
    }
    try {
      await api(`/trades/${tradeId}`, { method: 'PATCH', body });
      return { queued: false };
    } catch (err) {
      if (unlocked && err instanceof NetworkError) {
        enqueueTradeJournal(tradeId, body);
        return { queued: true };
      }
      throw err;
    }
  };

  return { saveJournal };
}

/** The queued quick-journal body for a trade, if one is waiting to sync — the
 *  review sheet seeds its fields from this so reopening it offline shows what
 *  the user last saved, not what the server last heard. */
export function usePendingTradeJournal(tradeId: string): PatchTradeRequest | null {
  const ops = usePendingOps();
  const op = ops.find(
    (candidate): candidate is Extract<OutboxOp, { kind: 'trade-journal' }> =>
      candidate.kind === 'trade-journal' && candidate.tradeId === tradeId,
  );
  return op?.body ?? null;
}
