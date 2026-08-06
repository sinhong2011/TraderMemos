import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { setTokens } from "@/lib/api/client";

/**
 * The signed-in account. Cheap and rarely changes — anything that needs the
 * email or has to gate on `is_admin` reads this one query.
 */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => authApi.me(),
    staleTime: 5 * 60_000,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      authApi.changePassword(current, next),
    // Adopting the returned pair is not optional: the change invalidates every
    // token minted against the old password, this tab's included, so skipping
    // it would sign the user out of the browser they just used.
    onSuccess: (tokens) => setTokens(tokens.access_token, tokens.refresh_token),
  });
}

export function useStartTotp() {
  return useMutation({ mutationFn: () => authApi.totpStart() });
}

export function useConfirmTotp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ secret, code }: { secret: string; code: string }) =>
      authApi.totpConfirm(secret, code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useDisableTotp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ password, code }: { password: string; code: string }) =>
      authApi.totpDisable(password, code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}
