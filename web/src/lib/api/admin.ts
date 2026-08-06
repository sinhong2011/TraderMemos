import { apiFetch } from "./client";

export interface AdminUser {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  totp_enabled: boolean;
}

export interface CreateAdminUserBody {
  email: string;
  password: string;
  is_admin: boolean;
}

export const adminApi = {
  listUsers: () => apiFetch<AdminUser[]>("/admin/users"),
  createUser: (body: CreateAdminUserBody) =>
    apiFetch<AdminUser>("/admin/users", { method: "POST", body: JSON.stringify(body) }),
  setAdmin: (id: string, isAdmin: boolean) =>
    apiFetch<AdminUser>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_admin: isAdmin }),
    }),
  resetPassword: (id: string, newPassword: string) =>
    apiFetch<void>(`/admin/users/${id}/password`, {
      method: "POST",
      body: JSON.stringify({ new_password: newPassword }),
    }),
  deleteUser: (id: string) => apiFetch<void>(`/admin/users/${id}`, { method: "DELETE" }),
};
