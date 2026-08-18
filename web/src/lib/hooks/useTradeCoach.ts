import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { tradesApi, type TradeCoachApiNote, type TradeCoachReview } from "@/lib/api/trades";
import { useCoachSettings } from "./useCoachSettings";

export const tradeCoachReviewsKey = (tradeId: string) => ["trade-coach-reviews", tradeId] as const;

/**
 * Coach LLM is opt-in per trade — call `generate()` from a button.
 *
 * Generation streams: notes are rendered as the model produces them instead of
 * after a minute of nothing. `streamingNotes` holds what has arrived so far and
 * is only meaningful while `isPending`; once the stream finishes, `data` holds
 * the authoritative review, which is the only thing carrying the next action.
 *
 * Past reviews are read back from the server so opening a trade shows the last
 * one immediately: a review costs a model call, so it should not vanish with
 * the component.
 */
export function useTradeCoach(tradeId: string | undefined) {
  const settings = useCoachSettings();
  const qc = useQueryClient();
  const coachConfigured = settings.data?.enabled === true;
  const [streamingNotes, setStreamingNotes] = useState<TradeCoachApiNote[]>([]);

  const stored = useQuery({
    queryKey: tradeCoachReviewsKey(tradeId ?? ""),
    queryFn: () => tradesApi.coachReviews(tradeId as string),
    enabled: Boolean(tradeId) && coachConfigured,
  });

  const mutation = useMutation({
    mutationFn: (): Promise<TradeCoachReview> => {
      if (!tradeId) throw new Error("missing trade id");
      setStreamingNotes([]);
      return tradesApi.coachStream(tradeId, (note) => {
        setStreamingNotes((prev) => [...prev, note]);
      });
    },
    onSettled: () => {
      // The final review supersedes the partial list either way; on failure the
      // partials would otherwise linger as if they were a finished review.
      setStreamingNotes([]);
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
  const { reset: resetMutation } = mutation;
  const reset = useCallback(() => {
    setStreamingNotes([]);
    resetMutation();
  }, [resetMutation]);

  return {
    coachConfigured,
    settingsPending: settings.isPending,
    isPending: mutation.isPending,
    isError: mutation.isError,
    data,
    /** Notes received so far in an in-flight stream; empty when idle. */
    streamingNotes,
    /** True when what's on screen was read back from storage, not generated now. */
    fromStorage: mutation.data == null && storedReview != null,
    /** Every stored review for this trade, newest first. */
    history: stored.data?.reviews ?? [],
    error: mutation.error,
    generate: mutation.mutateAsync,
    reset,
  };
}
