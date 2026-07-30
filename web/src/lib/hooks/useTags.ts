import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tagsApi } from "@/lib/api/tags";

export function useTags(kind?: string) {
  return useQuery({
    queryKey: ["tags", kind],
    queryFn: () => tagsApi.list(kind),
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof tagsApi.update>[1] }) =>
      tagsApi.update(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tagsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  });
}
