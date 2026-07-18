import { apiFetch } from "./client";

export interface ExecutionBody {
  account_id: string;
  symbol: string;
  instrument_type: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  commission?: number;
  executed_at: string;
  multiplier?: number;
  /** Opaque JSON for option_right / strike / expiry / lot. */
  details?: Record<string, string>;
}

export interface UpdateExecutionBody {
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  commission?: number;
  executed_at: string;
}

export interface CreateExecutionResponse {
  execution_id: string;
  trade_id: string;
}

export interface MutationExecutionResponse {
  execution_id: string;
  trade_id: string;
}

export const executionsApi = {
  create: (body: ExecutionBody) =>
    apiFetch<CreateExecutionResponse>("/executions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpdateExecutionBody) =>
    apiFetch<MutationExecutionResponse>(`/executions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    apiFetch<MutationExecutionResponse>(`/executions/${id}`, {
      method: "DELETE",
    }),
};
