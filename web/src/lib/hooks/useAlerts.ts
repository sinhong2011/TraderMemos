import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type AlertSettings, alertsApi } from "@/lib/api/alerts";

export function useAlertSettings() {
  return useQuery({
    queryKey: ["settings", "alerts"],
    queryFn: () => alertsApi.getSettings(),
  });
}

export function useSaveAlertSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AlertSettings) => alertsApi.putSettings(body),
    onSuccess: (data) => {
      qc.setQueryData(["settings", "alerts"], data);
    },
  });
}

export function useAlertChannels() {
  return useQuery({
    queryKey: ["settings", "alert-channels"],
    queryFn: () => alertsApi.listChannels(),
  });
}

function useInvalidateChannels() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ["settings", "alert-channels"] });
}

export function useCreateWebhookChannel() {
  const invalidate = useInvalidateChannels();
  return useMutation({
    mutationFn: (body: { target: string; label?: string }) => alertsApi.createWebhook(body),
    onSuccess: invalidate,
  });
}

export function useSetAlertChannelEnabled() {
  const invalidate = useInvalidateChannels();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      alertsApi.setChannelEnabled(id, enabled),
    onSuccess: invalidate,
  });
}

export function useDeleteAlertChannel() {
  const invalidate = useInvalidateChannels();
  return useMutation({
    mutationFn: (id: string) => alertsApi.deleteChannel(id),
    onSuccess: invalidate,
  });
}

export function useTestAlertChannel() {
  const invalidate = useInvalidateChannels();
  return useMutation({
    mutationFn: (id: string) => alertsApi.testChannel(id),
    // The test send stamps last_status/last_error on the channel row.
    onSettled: invalidate,
  });
}

export function useAlertEvents(limit = 10) {
  return useQuery({
    queryKey: ["alerts", "events", limit],
    queryFn: () => alertsApi.listEvents(limit),
  });
}
