import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTrades } from "./useTrades";

afterEach(() => vi.restoreAllMocks());

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useTrades", () => {
  it("fetches the trade list for the current filters", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: "t1", symbol: "AAPL", net_pnl: 198 }]), { status: 200 }),
    );
    const { result } = renderHook(() => useTrades({ account_id: "a1" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].symbol).toBe("AAPL");
  });
});
