/** Injected at build time from repo root VERSION (+ optional VITE_APP_* overrides). */
export const APP_VERSION: string = __APP_VERSION__;
export const APP_BUILD: string = __APP_BUILD__;

export const REPO_URL = "https://github.com/sinhong2011/TraderMemos";

export function formatVersion(version: string, build?: string): string {
  const v = version.trim().replace(/^v/i, "");
  if (!build) return `v${v}`;
  return `v${v} (${build})`;
}
