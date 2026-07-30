import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { attachmentsApi } from "@/lib/api/attachments";

export function useAttachments(tradeId: string) {
  return useQuery({
    queryKey: ["attachments", tradeId],
    queryFn: () => attachmentsApi.list(tradeId),
    enabled: Boolean(tradeId),
  });
}

export function useUploadAttachment(tradeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => attachmentsApi.upload(tradeId, formData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attachments", tradeId] }),
  });
}

export function useDeleteAttachment(tradeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => attachmentsApi.delete(attachmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attachments", tradeId] }),
  });
}
