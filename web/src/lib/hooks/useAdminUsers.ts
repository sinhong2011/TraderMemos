import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type CreateAdminUserBody } from "@/lib/api/admin";

const USERS_KEY = ["admin", "users"];

/**
 * Every account on this server. Owner-only — the API answers 403 to anyone
 * else, so callers gate the query on `me.is_admin` rather than showing a
 * section that can only fail.
 */
export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: () => adminApi.listUsers(),
    enabled,
  });
}

function useUsersMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useCreateUser() {
  return useUsersMutation((body: CreateAdminUserBody) => adminApi.createUser(body));
}

export function useSetUserAdmin() {
  return useUsersMutation(({ id, isAdmin }: { id: string; isAdmin: boolean }) =>
    adminApi.setAdmin(id, isAdmin),
  );
}

export function useResetUserPassword() {
  return useUsersMutation(({ id, password }: { id: string; password: string }) =>
    adminApi.resetPassword(id, password),
  );
}

export function useDeleteUser() {
  return useUsersMutation((id: string) => adminApi.deleteUser(id));
}
