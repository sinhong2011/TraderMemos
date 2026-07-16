import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type CreateExecutionResponse,
  type ExecutionBody,
  type MutationExecutionResponse,
  type UpdateExecutionBody,
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

function invalidateTradeQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["trades"] });
  void queryClient.invalidateQueries({ queryKey: ["trade"] });
  void queryClient.invalidateQueries({ queryKey: ["analytics"] });
  void queryClient.invalidateQueries({ queryKey: ["cash"] });
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
    onSettled: () => invalidateTradeQueries(queryClient),
  });
}

export function useUpdateExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateExecutionBody;
    }): Promise<MutationExecutionResponse> => executionsApi.update(id, body),
    onSettled: () => invalidateTradeQueries(queryClient),
  });
}

export function useDeleteExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string): Promise<MutationExecutionResponse> => executionsApi.delete(id),
    onSettled: () => invalidateTradeQueries(queryClient),
  });
}
