import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LlmApiModelsRequest, LlmApiSettingsTestRequest } from "@/lib/llmApiSettings";
import { type CoachSettingsPut, settingsApi } from "@/lib/api/settings";

export function useCoachSettings() {
  return useQuery({
    queryKey: ["settings", "coach"],
    queryFn: () => settingsApi.getCoachSettings(),
  });
}

export function useSaveCoachSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CoachSettingsPut) => settingsApi.putCoachSettings(body),
    onSuccess: (data) => {
      qc.setQueryData(["settings", "coach"], data);
    },
  });
}

export function useTestCoachSettings() {
  return useMutation({
    mutationFn: (body: LlmApiSettingsTestRequest) => settingsApi.testCoachSettings(body),
  });
}

export function useListCoachModels() {
  return useMutation({
    mutationFn: (body: LlmApiModelsRequest) => settingsApi.listCoachModels(body),
  });
}
