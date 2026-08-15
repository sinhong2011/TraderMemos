import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type CreateExecutionResponse,
  type ExecutionBody,
  type MutationExecutionResponse,
  type UpdateExecutionBody,
  executionsApi,
} from "@/lib/api/executions";
import { armRollingNumbers } from "@/lib/rollingNumbers";

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
  /** Last trade_id seen per symbol (uppercased). */
  bySymbol: Record<string, string>;
}

function invalidateTradeQueries(queryClient: ReturnType<typeof useQueryClient>) {
  // Every fill write funnels through here, which makes it the one place that
  // knows a figure about to move was moved by the user (see rollingNumbers).
  armRollingNumbers();
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
      const tradeIdSet = new Set<string>();
      const bySymbol: Record<string, string> = {};
      let total = 0;

      for (const accountId of accountIds) {
        for (let i = 0; i < rows.length; i++) {
          total += 1;
          try {
            const res: CreateExecutionResponse = await executionsApi.create({
              ...rows[i],
              account_id: accountId,
            });
            tradeIdSet.add(res.trade_id);
            const sym = rows[i].symbol.trim().toUpperCase();
            if (sym) bySymbol[sym] = res.trade_id;
          } catch (e) {
            failures.push({
              index: i,
              accountId,
              message: e instanceof Error ? e.message : "request failed",
            });
          }
        }
      }

      if (failures.length > 0) {
        throw new ExecutionBatchError(failures, total);
      }
      return { tradeIds: [...tradeIdSet], bySymbol };
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
