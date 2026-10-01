import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type RoutineBody, type RoutineDay, routinesApi } from "@/lib/api/routines";

const KEY = ["routines"] as const;

export function useRoutineItems(day: string) {
  return useQuery({ queryKey: [...KEY, "items", day], queryFn: () => routinesApi.list(day) });
}

export function useRoutineDay(day: string) {
  return useQuery({ queryKey: [...KEY, "day", day], queryFn: () => routinesApi.day(day) });
}

export function useRoutineHistory(from: string, to: string) {
  return useQuery({
    queryKey: [...KEY, "history", from, to],
    queryFn: () => routinesApi.history(from, to),
  });
}

/** Any routine write can change items, days and history at once. */
function useInvalidateRoutines() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: KEY });
}

/**
 * Tick or untick an item. The day flips optimistically so the box answers the
 * click at once; the server's day replaces it, and history refetches after.
 */
export function useCheckRoutine() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: ({ day, id, done }: { day: string; id: string; done: boolean }) =>
      routinesApi.check(day, id, done),
    onMutate: async ({ day, id, done }) => {
      const key = [...KEY, "day", day];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<RoutineDay>(key);
      if (prev) {
        const items = prev.items.map((it) => (it.id === id ? { ...it, done } : it));
        queryClient.setQueryData<RoutineDay>(key, {
          ...prev,
          items,
          done: items.filter((it) => it.done).length,
        });
      }
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (day, vars) => queryClient.setQueryData([...KEY, "day", vars.day], day),
    onSettled: () => invalidate(),
  });
}

export function useCreateRoutine() {
  const invalidate = useInvalidateRoutines();
  return useMutation({ mutationFn: routinesApi.create, onSuccess: invalidate });
}

export function useUpdateRoutine() {
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RoutineBody }) => routinesApi.update(id, body),
    onSuccess: invalidate,
  });
}

export function useArchiveRoutine() {
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: ({ id, day }: { id: string; day: string }) => routinesApi.archive(id, day),
    onSuccess: invalidate,
  });
}

export function useOrderRoutines() {
  const invalidate = useInvalidateRoutines();
  return useMutation({ mutationFn: routinesApi.order, onSettled: invalidate });
}
