import { create } from "zustand";
import { persist } from "zustand/middleware";

export const LLM_MODEL_CACHE_STORAGE_KEY = "tm-llm-model-cache";

/** Keep the most recently fetched providers only. */
const MAX_CACHED_BASE_URLS = 8;

interface LlmModelCacheState {
  /** Fetched model ids per API base URL, so lists survive navigation. */
  modelsByBaseUrl: Record<string, string[]>;
  setModels: (baseUrl: string, models: string[]) => void;
}

function sanitize(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string[]> = {};
  for (const [url, models] of Object.entries(value)) {
    if (Array.isArray(models) && models.every((m) => typeof m === "string")) {
      out[url] = models;
    }
  }
  return out;
}

export const useLlmModelCache = create<LlmModelCacheState>()(
  persist(
    (set) => ({
      modelsByBaseUrl: {},
      setModels: (baseUrl, models) =>
        set((s) => {
          const { [baseUrl]: _, ...rest } = s.modelsByBaseUrl;
          const entries = Object.entries(rest).slice(-(MAX_CACHED_BASE_URLS - 1));
          return { modelsByBaseUrl: { ...Object.fromEntries(entries), [baseUrl]: models } };
        }),
    }),
    {
      name: LLM_MODEL_CACHE_STORAGE_KEY,
      partialize: (s) => ({ modelsByBaseUrl: s.modelsByBaseUrl }),
      merge: (persisted, current) => {
        const raw = persisted as Partial<LlmModelCacheState> | undefined;
        return { ...current, modelsByBaseUrl: sanitize(raw?.modelsByBaseUrl) };
      },
    },
  ),
);
