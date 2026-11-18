import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tradesApi } from "@/lib/api/trades";
import type { Trade } from "@/lib/api/types";
import { armRollingNumbers } from "./rollingNumbers";

/**
 * Bulk edits run as one PATCH/DELETE per trade — the API has no batch
 * endpoint, and a trade's tag list is replaced wholesale, so each new list is
 * computed from what the row already carries.
 */
export type BulkTradeOp =
  | { kind: "add-tags"; tagIds: string[] }
  | { kind: "remove-tags"; tagIds: string[] }
  | { kind: "set-tags"; tagIdsByTrade: Record<string, string[]> }
  | { kind: "set-setup"; setupId: string | null }
  | { kind: "delete" };

/** Requests in flight at once — enough to feel instant, gentle on SQLite. */
export const BULK_CONCURRENCY = 4;

export function addTagIds(current: string[], add: string[]): string[] {
  const out = [...current];
  for (const id of add) if (!out.includes(id)) out.push(id);
  return out;
}

export function removeTagIds(current: string[], remove: string[]): string[] {
  return current.filter((id) => !remove.includes(id));
}

/** The PATCH body one trade needs for `op`, or null when nothing would change. */
export function bulkPatchBody(
  trade: Trade,
  op: Exclude<BulkTradeOp, { kind: "delete" }>,
): { tag_ids?: string[]; setup_ids?: string[] } | null {
  const current = trade.tags.map((t) => t.id);
  switch (op.kind) {
    case "add-tags": {
      const next = addTagIds(current, op.tagIds);
      return next.length === current.length ? null : { tag_ids: next };
    }
    case "remove-tags": {
      const next = removeTagIds(current, op.tagIds);
      return next.length === current.length ? null : { tag_ids: next };
    }
    case "set-tags": {
      // Always sent: an undo is handed the rows as they were *before* the
      // edit, so comparing against `trade.tags` would skip every restore.
      const next = op.tagIdsByTrade[trade.id];
      return next ? { tag_ids: next } : null;
    }
    case "set-setup":
      return { setup_ids: op.setupId ? [op.setupId] : [] };
  }
}

/** Run `task` over `items`, at most `limit` at a time; never rejects. */
export async function runPool<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<unknown>,
): Promise<{ ok: T[]; failed: T[] }> {
  const ok: T[] = [];
  const failed: T[] = [];
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      try {
        await task(item);
        ok.push(item);
      } catch {
        failed.push(item);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return { ok, failed };
}

export interface BulkResult {
  /** Trades the op changed (or deleted). */
  changed: Trade[];
  /** Trades already in the requested state — no request sent. */
  skipped: Trade[];
  failed: Trade[];
}

export function useBulkTradeEdit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ trades, op }: { trades: Trade[]; op: BulkTradeOp }) => {
      const skipped: Trade[] = [];
      const work: { trade: Trade; run: () => Promise<unknown> }[] = [];
      for (const trade of trades) {
        if (op.kind === "delete") {
          work.push({ trade, run: () => tradesApi.delete(trade.id) });
          continue;
        }
        const body = bulkPatchBody(trade, op);
        if (body) work.push({ trade, run: () => tradesApi.patch(trade.id, body) });
        else skipped.push(trade);
      }
      const { ok, failed } = await runPool(work, BULK_CONCURRENCY, (w) => w.run());
      return {
        changed: ok.map((w) => w.trade),
        skipped,
        failed: failed.map((w) => w.trade),
      } satisfies BulkResult;
    },
    onSettled: (_res, _err, { op }) => {
      if (op.kind === "delete") {
        armRollingNumbers();
        void queryClient.invalidateQueries({ queryKey: ["cash"] });
      }
      // Tag and setup breakdowns live in analytics too.
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
      void queryClient.invalidateQueries({ queryKey: ["trade"] });
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });
}
