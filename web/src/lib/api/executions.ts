import { apiFetch } from "./client";

export interface ExecutionBody {
  account_id: string;
  symbol: string;
  instrument_type: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  executed_at: string;
}

export interface CreateExecutionResponse {
  execution_id: string;
  trade_id: string;
}

export const executionsApi = {
  create: (body: ExecutionBody) =>
    apiFetch<CreateExecutionResponse>("/executions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
