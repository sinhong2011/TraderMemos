import { apiFetch } from "./client";

export interface ExtractedFill {
  symbol?: string;
  side: string;
  quantity: number;
  price: number;
  fees: number;
  commission: number;
  executed_at: string;
  option_right?: string;
  strike?: number;
  expiry?: string;
}

export interface TradeExtract {
  symbol: string;
  instrument_type: string;
  side: string;
  confidence: number;
  raw_text: string;
  rows: ExtractedFill[];
  warnings: string[];
  /** Present when a scan contains more than one underlying. */
  symbols?: string[];
}

export const ocrApi = {
  parse: (formData: FormData) =>
    apiFetch<TradeExtract>("/ocr/parse", {
      method: "POST",
      body: formData,
    }),
};
