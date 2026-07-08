import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ExecutionBody, executionsApi } from "../api/executions";

export interface ExecutionFailure {
	index: number;
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

// Posts executions one-by-one so a single bad row doesn't sink the batch;
// the server regroups trades after each insert.
export function useCreateExecutions() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (rows: ExecutionBody[]) => {
			const failures: ExecutionFailure[] = [];
			for (let i = 0; i < rows.length; i++) {
				try {
					await executionsApi.create(rows[i]);
				} catch (e) {
					failures.push({
						index: i,
						message: e instanceof Error ? e.message : "request failed",
					});
				}
			}
			if (failures.length > 0) {
				throw new ExecutionBatchError(failures, rows.length);
			}
			return rows.length;
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["trades"] });
			queryClient.invalidateQueries({ queryKey: ["analytics"] });
		},
	});
}
