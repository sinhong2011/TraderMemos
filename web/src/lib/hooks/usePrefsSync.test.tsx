import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useAuth } from "@/lib/auth";
import { preferencesQueryKey } from "@/lib/prefsSync";
import { usePrefsSync } from "./usePrefsSync";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("@/lib/api/preferences", () => ({ preferencesApi: api }));

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  api.get.mockReset().mockResolvedValue({ prefs: {} });
  api.patch.mockReset().mockResolvedValue({ prefs: {} });
  useAuth.setState({ authed: true });
});

describe("usePrefsSync", () => {
  /*
   * Regression: the phone persists its query cache to MMKV, so a staleTime on
   * this query meant a cold start replayed the copy that device already had
   * and never asked the server — a preference changed elsewhere never arrived,
   * which is the entire thing this sync exists to do. Caught on a simulator,
   * not by the suite, so it gets a test.
   */
  it("asks the server even when a cached answer is already in hand", async () => {
    const client = newClient();
    client.setQueryData(preferencesQueryKey, { prefs: { timeFormat: "h23" } });

    renderHook(() => usePrefsSync(), { wrapper: wrapper(client) });

    await waitFor(() => expect(api.get).toHaveBeenCalled());
  });

  it("asks for nothing while signed out", () => {
    useAuth.setState({ authed: false });
    renderHook(() => usePrefsSync(), { wrapper: wrapper(newClient()) });
    expect(api.get).not.toHaveBeenCalled();
  });

  // An account that has stored nothing adopts this browser's setup rather than
  // resetting it to defaults.
  it("seeds an empty account from what is already set locally", async () => {
    renderHook(() => usePrefsSync(), { wrapper: wrapper(newClient()) });
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(api.patch.mock.calls[0][0]).toHaveProperty("marketTimezone");
  });

  it("sends nothing when the account already has every key", async () => {
    api.get.mockResolvedValue({
      prefs: {
        displayCurrency: null,
        timezone: "UTC",
        marketTimezone: "UTC",
        timeFormat: "h23",
        tradeDateBasis: "open",
        maxScreenshotsPerTrade: null,
      },
    });
    renderHook(() => usePrefsSync(), { wrapper: wrapper(newClient()) });
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(api.patch).not.toHaveBeenCalled();
  });
});
