import { useMutation } from "@tanstack/react-query";
import { ocrApi, type TradeExtract } from "../api/ocr";

export function useOcrParse() {
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return ocrApi.parse(fd);
    },
  });
}

export type { TradeExtract };
