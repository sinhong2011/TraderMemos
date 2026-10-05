import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reviewsApi } from "@/lib/api/reviews";

export function useReviewInbox(accountId?: string) {
  return useQuery({
    queryKey: ["reviews", "inbox", accountId ?? null],
    queryFn: () => reviewsApi.inbox(accountId),
  });
}

export function useDismissReviewBacklog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reviewsApi.dismissBacklog(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reviews"] }),
  });
}
