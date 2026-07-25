import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { setupsApi } from "@/lib/api/setups";

export function useSetups() {
  return useQuery({ queryKey: ["setups"], queryFn: () => setupsApi.list() });
}

export function useCreateSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setupsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["setups"] }),
  });
}

export function useUpdateSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof setupsApi.update>[1] }) =>
      setupsApi.update(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["setups"] }),
  });
}

export function useDeleteSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => setupsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["setups"] }),
  });
}
