import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  computeVersionMismatch,
  initAppUpdates,
  type SerwistLike,
  useAppUpdate,
} from "./appUpdate";
import type { GitHubRelease } from "./releases";

vi.mock("./releases", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./releases")>();
  return {
    ...actual,
    fetchLatestRelease: vi.fn<() => Promise<GitHubRelease | null>>(async () => null),
  };
});
vi.mock("./hooks/useApiHealth", () => ({
  fetchApiHealth: vi.fn<() => Promise<null>>(async () => null),
}));

import { fetchLatestRelease } from "./releases";

function release(version: string): GitHubRelease {
  return {
    version,
    tag: `v${version}`,
    name: `v${version}`,
    body: "",
    excerpt: "",
    publishedAt: "2026-08-01T00:00:00Z",
    url: `https://example.com/releases/v${version}`,
    prerelease: false,
  };
}

afterEach(() => {
  useAppUpdate.setState({
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
  });
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("computeVersionMismatch", () => {
  it("flags differing web and api versions", () => {
    expect(computeVersionMismatch("0.1.9", "0.1.10")).toBe(true);
    expect(computeVersionMismatch("v0.1.10", "0.1.10")).toBe(false);
    expect(computeVersionMismatch("0.1.10", "0.1.10")).toBe(false);
  });

  it("ignores missing or dev versions", () => {
    expect(computeVersionMismatch(null, "0.1.10")).toBe(false);
    expect(computeVersionMismatch("dev", "0.1.10")).toBe(false);
    expect(computeVersionMismatch("0.1.10", "dev")).toBe(false);
    expect(computeVersionMismatch("", "0.1.10")).toBe(false);
  });
});

describe("dismiss", () => {
  it("stays dismissed across checks for the same release", async () => {
    vi.mocked(fetchLatestRelease).mockResolvedValue(release("99.0.0"));
    await useAppUpdate.getState().checkForUpdates();
    expect(useAppUpdate.getState().webBehind).toBe(true);
    expect(useAppUpdate.getState().dismissed).toBe(false);

    useAppUpdate.getState().dismiss();
    expect(useAppUpdate.getState().dismissed).toBe(true);

    // A later check of the same release (or a fresh page load) keeps it hidden.
    await useAppUpdate.getState().checkForUpdates();
    expect(useAppUpdate.getState().dismissed).toBe(true);
  });

  it("resurfaces when a newer release ships", async () => {
    vi.mocked(fetchLatestRelease).mockResolvedValue(release("99.0.0"));
    await useAppUpdate.getState().checkForUpdates();
    useAppUpdate.getState().dismiss();

    vi.mocked(fetchLatestRelease).mockResolvedValue(release("99.0.1"));
    await useAppUpdate.getState().checkForUpdates();
    expect(useAppUpdate.getState().dismissed).toBe(false);
  });
});

describe("initAppUpdates", () => {
  it("marks swReady when waiting fires", async () => {
    Object.defineProperty(globalThis.navigator, "serviceWorker", {
      configurable: true,
      value: {},
    });
    const listeners = new Map<string, () => void>();
    const serwist: SerwistLike = {
      register: vi.fn<() => Promise<ServiceWorkerRegistration | undefined>>(async () => undefined),
      update: vi.fn<() => Promise<void>>(async () => undefined),
      messageSkipWaiting: vi.fn<(...args: any[]) => any>(),
      addEventListener: (type, listener) => {
        listeners.set(type, listener);
      },
    };
    await initAppUpdates(async () => serwist);
    expect(serwist.register).toHaveBeenCalledOnce();
    listeners.get("waiting")?.();
    expect(useAppUpdate.getState().swReady).toBe(true);
  });
});
