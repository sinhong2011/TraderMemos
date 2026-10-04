import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useBackupAttention } from "./useBackup";

const me = vi.hoisted(() => ({ data: { is_admin: true } as { is_admin: boolean } | undefined }));
vi.mock("./useMe", () => ({ useMe: () => me }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function respond(status: string) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify({ status }), { status: 200 }));
}

beforeEach(() => {
  me.data = { is_admin: true };
});
afterEach(() => vi.restoreAllMocks());

describe("useBackupAttention", () => {
  it("raises the shell dot when the last backup failed", async () => {
    respond("failed");
    const { result } = renderHook(() => useBackupAttention(), { wrapper });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("raises it for an overdue backup", async () => {
    respond("stale");
    const { result } = renderHook(() => useBackupAttention(), { wrapper });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("stays quiet for a healthy or unsupported server", async () => {
    const fetchSpy = respond("ok");
    const { result } = renderHook(() => useBackupAttention(), { wrapper });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it("never asks the owner-only endpoint for a member", async () => {
    me.data = { is_admin: false };
    const fetchSpy = respond("failed");
    const { result } = renderHook(() => useBackupAttention(), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current).toBe(false);
  });
});
