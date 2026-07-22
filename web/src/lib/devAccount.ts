/** Demo credentials — same defaults as e2e/smoke.spec.ts */
export const DEV_ACCOUNT = {
  email: (import.meta.env.VITE_DEV_EMAIL as string | undefined) ?? "demo@tradermemos.app",
  password: (import.meta.env.VITE_DEV_PASSWORD as string | undefined) ?? "hunter2",
} as const;

export function isDevAuthEnabled(): boolean {
  return import.meta.env.DEV;
}
