import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type OcrModelsRequest,
  type OcrSettingsPut,
  type OcrSettingsTestRequest,
  settingsApi,
} from "@/lib/api/settings";

export function useOcrSettings() {
  return useQuery({
    queryKey: ["settings", "ocr"],
    queryFn: () => settingsApi.getOcrSettings(),
  });
}

export function useSaveOcrSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OcrSettingsPut) => settingsApi.putOcrSettings(body),
    onSuccess: (data) => {
      qc.setQueryData(["settings", "ocr"], data);
    },
  });
}

export function useTestOcrSettings() {
  return useMutation({
    mutationFn: (body: OcrSettingsTestRequest) => settingsApi.testOcrSettings(body),
  });
}

export function useListOcrModels() {
  return useMutation({
    mutationFn: (body: OcrModelsRequest) => settingsApi.listOcrModels(body),
  });
}
