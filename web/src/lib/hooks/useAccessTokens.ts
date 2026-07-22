import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tokensApi, type CreateAccessTokenBody } from "../api/tokens";

export function useAccessTokens() {
  return useQuery({
    queryKey: ["access-tokens"],
    queryFn: () => tokensApi.list(),
  });
}

export function useCreateAccessToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAccessTokenBody) => tokensApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["access-tokens"] }),
  });
}

export function useRevokeAccessToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tokensApi.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["access-tokens"] }),
  });
}
