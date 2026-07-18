import { useMutation } from "@tanstack/react-query";
import { ocrApi, type TradeExtract } from "../api/ocr";
import { mergeTradeExtracts } from "../ocrSymbolGroups";

/** Cap multi-select screenshots so a single scan stays affordable. */
export const OCR_SCAN_MAX_FILES = 8;

export function useOcrParse() {
  return useMutation({
    mutationFn: async (input: File | File[]) => {
      const files = (Array.isArray(input) ? input : [input]).slice(0, OCR_SCAN_MAX_FILES);
      if (files.length === 0) {
        throw new Error("Select at least one screenshot");
      }
      const extracts: TradeExtract[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        extracts.push(await ocrApi.parse(fd));
      }
      return mergeTradeExtracts(extracts);
    },
  });
}

export type { TradeExtract };
