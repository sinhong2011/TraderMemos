import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { initAppUpdates, type SerwistLike, useAppUpdate } from "./appUpdate";

afterEach(() => {
  useAppUpdate.setState({
    swReady: false,
    checking: false,
    lastCheckedAt: null,
    remote: null,
    apiVersion: null,
    webBehind: false,
    apiBehind: false,
    remoteNewer: false,
    checkError: null,
    dismissed: false,
  });
  vi.restoreAllMocks();
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
      messageSkipWaiting: vi.fn<() => void>(),
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
