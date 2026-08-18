import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tradesApi, type TradeCoachReview } from "@/lib/api/trades";
import { useCoachSettings } from "./useCoachSettings";

export const tradeCoachReviewsKey = (tradeId: string) => ["trade-coach-reviews", tradeId] as const;

/**
 * Coach LLM is opt-in per trade — call `generate()` from a button.
 *
 * Past reviews are read back from the server so opening a trade shows the last
 * one immediately: a review costs a model call, so it should not vanish with
 * the component. A freshly generated review takes precedence over the stored
 * one for the rest of the session.
 */
export function useTradeCoach(tradeId: string | undefined) {
  const settings = useCoachSettings();
  const qc = useQueryClient();
  const coachConfigured = settings.data?.enabled === true;

  const stored = useQuery({
    queryKey: tradeCoachReviewsKey(tradeId ?? ""),
    queryFn: () => tradesApi.coachReviews(tradeId as string),
    enabled: Boolean(tradeId) && coachConfigured,
  });

  const mutation = useMutation({
    mutationFn: (): Promise<TradeCoachReview> => {
      if (!tradeId) throw new Error("missing trade id");
      return tradesApi.coach(tradeId);
    },
    onSuccess: () => {
      if (tradeId) void qc.invalidateQueries({ queryKey: tradeCoachReviewsKey(tradeId) });
    },
  });

  const latestStored = stored.data?.reviews?.[0];
  const storedReview: TradeCoachReview | undefined = latestStored
    ? {
        source: "llm",
        notes: latestStored.notes,
        next_action: latestStored.next_action,
        id: latestStored.id,
        created_at: latestStored.created_at,
      }
    : undefined;

  const data = mutation.data ?? storedReview;

  return {
    coachConfigured,
    settingsPending: settings.isPending,
    isPending: mutation.isPending,
    isError: mutation.isError,
    data,
    /** True when what's on screen was read back from storage, not generated now. */
    fromStorage: mutation.data == null && storedReview != null,
    /** Every stored review for this trade, newest first. */
    history: stored.data?.reviews ?? [],
    error: mutation.error,
    generate: mutation.mutateAsync,
    reset: mutation.reset,
  };
}
