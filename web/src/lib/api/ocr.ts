import { apiFetch } from "./client";

export interface ExtractedFill {
  side: string;
  quantity: number;
  price: number;
  fees: number;
  commission: number;
  executed_at: string;
}

export interface TradeExtract {
  symbol: string;
  instrument_type: string;
  side: string;
  confidence: number;
  raw_text: string;
  rows: ExtractedFill[];
  warnings: string[];
}

export const ocrApi = {
  parse: (formData: FormData) =>
    apiFetch<TradeExtract>("/ocr/parse", {
      method: "POST",
      body: formData,
    }),
};
