import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	type CreateExecutionResponse,
	type ExecutionBody,
	executionsApi,
} from "../api/executions";

export interface ExecutionFailure {
	index: number;
	accountId: string;
	message: string;
}

export class ExecutionBatchError extends Error {
	failures: ExecutionFailure[];
	total: number;
	constructor(failures: ExecutionFailure[], total: number) {
		super(`${failures.length} of ${total} executions failed`);
		this.name = "ExecutionBatchError";
		this.failures = failures;
		this.total = total;
	}
}

export interface SaveExecutionsInput {
	accountIds: string[];
	rows: Omit<ExecutionBody, "account_id">[];
}

export interface SaveExecutionsResult {
	tradeIds: string[];
}

export function useCreateExecutions() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			accountIds,
			rows,
		}: SaveExecutionsInput): Promise<SaveExecutionsResult> => {
			const failures: ExecutionFailure[] = [];
			const tradeIds: string[] = [];
			let total = 0;

			for (const accountId of accountIds) {
				let lastTradeId = "";
				for (let i = 0; i < rows.length; i++) {
					total += 1;
					try {
						const res: CreateExecutionResponse = await executionsApi.create({
							...rows[i],
							account_id: accountId,
						});
						lastTradeId = res.trade_id;
					} catch (e) {
						failures.push({
							index: i,
							accountId,
							message: e instanceof Error ? e.message : "request failed",
						});
					}
				}
				if (lastTradeId) tradeIds.push(lastTradeId);
			}

			if (failures.length > 0) {
				throw new ExecutionBatchError(failures, total);
			}
			return { tradeIds };
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["trades"] });
			queryClient.invalidateQueries({ queryKey: ["trade"] });
			queryClient.invalidateQueries({ queryKey: ["analytics"] });
			queryClient.invalidateQueries({ queryKey: ["cash"] });
		},
	});
}
