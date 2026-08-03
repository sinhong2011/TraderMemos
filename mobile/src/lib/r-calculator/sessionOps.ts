/**
 * Pure, id-keyed list ops shared by every multi-session collection
 * (R-multiple calculator and FVG mode). Framework-free and unit-tested.
 */

/** Remove the item with `id`. Returns the same array reference when absent. */
export function removeById<T extends { id: string }>(items: T[], id: string): T[] {
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return items;
  return items.filter((i) => i.id !== id);
}

export interface CollectionState<T extends { id: string }> {
  sessions: T[];
  activeId: string;
}

/**
 * Remove a session from a collection, keeping at least one and moving the
 * active id to the previous slot when the active session is removed.
 * Returns the same reference when nothing changes.
 */
export function removeSessionById<T extends { id: string }>(
  state: CollectionState<T>,
  id: string,
): CollectionState<T> {
  if (state.sessions.length <= 1) return state;
  const idx = state.sessions.findIndex((s) => s.id === id);
  if (idx < 0) return state;
  const sessions = removeById(state.sessions, id);
  const activeId = state.activeId === id ? sessions[Math.max(0, idx - 1)].id : state.activeId;
  return { sessions, activeId };
}

/**
 * Move `fromId` into the slot occupied by `toId` (drag-to-reorder).
 * Returns the same reference when nothing moves; never mutates the input.
 */
export function reorderById<T extends { id: string }>(
  items: T[],
  fromId: string,
  toId: string,
): T[] {
  const fromIndex = items.findIndex((i) => i.id === fromId);
  const toIndex = items.findIndex((i) => i.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
