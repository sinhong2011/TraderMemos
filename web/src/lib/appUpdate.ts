import { create } from "zustand";
import { fetchApiHealth } from "./hooks/useApiHealth";
import { fetchLatestRelease, isNewerVersion, type GitHubRelease } from "./releases";
import { APP_VERSION } from "./version";

export type SerwistLike = {
  register: (opts?: { immediate?: boolean }) => Promise<ServiceWorkerRegistration | undefined>;
  update: () => Promise<void>;
  messageSkipWaiting: () => void;
  addEventListener: (type: "waiting" | "controlling", listener: () => void) => void;
};

export type UpdateSnapshot = {
  webVersion: string;
  apiVersion: string | null;
  latest: GitHubRelease | null;
  webBehind: boolean;
  apiBehind: boolean;
  releaseNewer: boolean;
};

type AppUpdateState = {
  /** True when a new service worker is waiting to activate. */
  swReady: boolean;
  checking: boolean;
  lastCheckedAt: number | null;
  remote: GitHubRelease | null;
  apiVersion: string | null;
  webBehind: boolean;
  apiBehind: boolean;
  /** Web and API versions differ from each other (deployment out of sync). */
  versionMismatch: boolean;
  /** GitHub release is newer than the running web build. */
  remoteNewer: boolean;
  checkError: string | null;
  /** The waiting-worker toast was dismissed for the current build (persisted). */
  dismissed: boolean;
  setSwReady: (ready: boolean) => void;
  dismiss: () => void;
  checkForUpdates: () => Promise<void>;
  applyUpdate: () => void;
  snapshot: () => UpdateSnapshot;
};

let serwistRef: SerwistLike | null = null;
let controllingReloadBound = false;

const DISMISSED_KEY = "tradermemos-update-dismissed-version";

/**
 * Dismissal is keyed to the build the waiting worker would replace: once the
 * update applies, APP_VERSION changes and the next release's worker resurfaces
 * the toast. Values written by older builds (a bare release version) never
 * match, so they self-correct.
 */
export function swDismissSignature(): string {
  return `sw@${APP_VERSION}`;
}

function readDismissedSignature(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function writeDismissedSignature(signature: string) {
  try {
    localStorage.setItem(DISMISSED_KEY, signature);
  } catch {
    // storage unavailable — dismissal lasts for the session only
  }
}

function computeBehind(latest: string | null | undefined, current: string | null | undefined) {
  if (!latest || !current) return false;
  return isNewerVersion(latest, current);
}

/** Web and API report different versions — the deployment is out of sync. */
export function computeVersionMismatch(apiVersion: string | null, webVersion: string): boolean {
  if (!apiVersion) return false;
  const norm = (v: string) => v.trim().replace(/^v/i, "");
  const api = norm(apiVersion);
  const web = norm(webVersion);
  // Dev builds carry no meaningful semver — don't flag them.
  if (!api || !web || api === "dev" || web === "dev") return false;
  return api !== web;
}

export const useAppUpdate = create<AppUpdateState>((set, get) => ({
  swReady: false,
  checking: false,
  lastCheckedAt: null,
  remote: null,
  apiVersion: null,
  webBehind: false,
  apiBehind: false,
  versionMismatch: false,
  remoteNewer: false,
  checkError: null,
  dismissed: false,
  setSwReady: (swReady) =>
    set({
      swReady,
      dismissed: swReady ? readDismissedSignature() === swDismissSignature() : get().dismissed,
    }),
  dismiss: () => {
    writeDismissedSignature(swDismissSignature());
    set({ dismissed: true });
  },
  snapshot: () => {
    const s = get();
    return {
      webVersion: APP_VERSION,
      apiVersion: s.apiVersion,
      latest: s.remote,
      webBehind: s.webBehind,
      apiBehind: s.apiBehind,
      releaseNewer: s.remoteNewer,
    };
  },
  checkForUpdates: async () => {
    set({ checking: true, checkError: null });
    try {
      await serwistRef?.update();

      const [remote, health] = await Promise.all([
        fetchLatestRelease(),
        fetchApiHealth().catch(() => null),
      ]);

      const apiVersion = health?.version ?? null;
      const latestVersion = remote?.version ?? null;
      const webBehind = computeBehind(latestVersion, APP_VERSION);
      const apiBehind = computeBehind(latestVersion, apiVersion);
      const versionMismatch = computeVersionMismatch(apiVersion, APP_VERSION);

      set({
        remote,
        apiVersion,
        webBehind,
        apiBehind,
        versionMismatch,
        remoteNewer: webBehind,
        lastCheckedAt: Date.now(),
        checking: false,
      });
    } catch (err) {
      set({
        checking: false,
        lastCheckedAt: Date.now(),
        checkError: err instanceof Error ? err.message : "Could not check for updates.",
      });
    }
  },
  applyUpdate: () => {
    if (!serwistRef) {
      window.location.reload();
      return;
    }
    if (!controllingReloadBound) {
      controllingReloadBound = true;
      serwistRef.addEventListener("controlling", () => {
        window.location.reload();
      });
    }
    serwistRef.messageSkipWaiting();
    if (!get().swReady) {
      window.location.reload();
    }
  },
}));

/**
 * Wire Serwist registration to the update store. Call once from `main.tsx`.
 */
export async function initAppUpdates(
  getSerwist: () => Promise<SerwistLike | undefined>,
): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const serwist = await getSerwist();
  if (!serwist) return;
  serwistRef = serwist;
  serwist.addEventListener("waiting", () => {
    useAppUpdate.getState().setSwReady(true);
  });
  await serwist.register();
  if (import.meta.env.MODE !== "test") {
    window.setTimeout(() => {
      void useAppUpdate.getState().checkForUpdates();
    }, 8_000);
  }
}
