import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { executionsApi } from "@/lib/api/executions";
import { ExecutionBatchError, useCreateExecutions } from "./useExecutions";

vi.mock("../api/executions", () => ({
  executionsApi: { create: vi.fn<(...args: any[]) => any>() },
}));

const mockedCreate = vi.mocked(executionsApi.create);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const ROW = {
  symbol: "AAPL",
  instrument_type: "stock",
  side: "buy" as const,
  quantity: 10,
  price: 100,
  fees: 1,
  executed_at: "2026-07-08T13:30:00.000Z",
};

describe("useCreateExecutions", () => {
  beforeEach(() => mockedCreate.mockReset());

  it("posts all rows sequentially and returns trade ids", async () => {
    mockedCreate.mockResolvedValue({
      execution_id: "e1",
      trade_id: "t1",
    });
    const { result } = renderHook(() => useCreateExecutions(), { wrapper });
    const res = await result.current.mutateAsync({
      accountIds: ["a1"],
      rows: [ROW, ROW],
    });
    expect(res.tradeIds).toEqual(["t1"]);
    expect(mockedCreate).toHaveBeenCalledTimes(2);
    expect(mockedCreate).toHaveBeenNthCalledWith(1, { ...ROW, account_id: "a1" });
  });

  it("throws ExecutionBatchError listing failed row indexes", async () => {
    mockedCreate
      .mockResolvedValueOnce({ execution_id: "e1", trade_id: "t1" })
      .mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useCreateExecutions(), { wrapper });
    await expect(
      result.current.mutateAsync({ accountIds: ["a1"], rows: [ROW, ROW] }),
    ).rejects.toThrow(ExecutionBatchError);
    await waitFor(() => expect(result.current.isError).toBe(true));
    const err = result.current.error as ExecutionBatchError;
    expect(err.failures).toEqual([{ index: 1, accountId: "a1", message: "boom" }]);
    expect(err.total).toBe(2);
  });
});
