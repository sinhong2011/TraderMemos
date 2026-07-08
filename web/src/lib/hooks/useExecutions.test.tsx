import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executionsApi } from "../api/executions";
import { ExecutionBatchError, useCreateExecutions } from "./useExecutions";

vi.mock("../api/executions", () => ({
	executionsApi: { create: vi.fn() },
}));

const mockedCreate = vi.mocked(executionsApi.create);

function wrapper({ children }: { children: ReactNode }) {
	const qc = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const ROW = {
	account_id: "a1",
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

	it("posts all rows sequentially and resolves with the count", async () => {
		let active = 0;
		let maxActive = 0;
		mockedCreate.mockImplementation(async () => {
			active++;
			maxActive = Math.max(maxActive, active);
			await new Promise((r) => setTimeout(r, 5));
			active--;
		});
		const { result } = renderHook(() => useCreateExecutions(), { wrapper });
		const count = await result.current.mutateAsync([ROW, ROW]);
		expect(count).toBe(2);
		expect(mockedCreate).toHaveBeenCalledTimes(2);
		expect(mockedCreate).toHaveBeenNthCalledWith(1, ROW);
		expect(mockedCreate).toHaveBeenNthCalledWith(2, ROW);
		expect(maxActive).toBe(1);
	});

	it("throws ExecutionBatchError listing failed row indexes", async () => {
		mockedCreate
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error("boom"));
		const { result } = renderHook(() => useCreateExecutions(), { wrapper });
		await expect(result.current.mutateAsync([ROW, ROW])).rejects.toThrow(
			ExecutionBatchError,
		);
		await waitFor(() => expect(result.current.isError).toBe(true));
		const err = result.current.error as ExecutionBatchError;
		expect(err.failures).toEqual([{ index: 1, message: "boom" }]);
		expect(err.total).toBe(2);
	});
});
