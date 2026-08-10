import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shareApi, type CreateShareLinkBody } from "@/lib/api/share";

export function useShareLinks(enabled = true) {
  return useQuery({
    queryKey: ["share-links"],
    queryFn: () => shareApi.list(),
    enabled,
  });
}

export function useCreateShareLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateShareLinkBody) => shareApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["share-links"] }),
  });
}

export function useRevokeShareLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shareApi.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["share-links"] }),
  });
}

/** The public page's query — no auth, no retry storm on 404. */
export function usePublicShare(token: string) {
  return useQuery({
    queryKey: ["public-share", token],
    queryFn: () => shareApi.getPublic(token),
    retry: false,
    staleTime: 60_000,
  });
}
