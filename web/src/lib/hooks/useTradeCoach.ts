import { useMutation } from "@tanstack/react-query";
import { tradesApi, type TradeCoachReview } from "@/lib/api/trades";
import { useCoachSettings } from "./useCoachSettings";

/** Coach LLM is opt-in per trade — call `generate()` from a button. */
export function useTradeCoach(tradeId: string | undefined) {
  const settings = useCoachSettings();
  const coachConfigured = settings.data?.enabled === true;

  const mutation = useMutation({
    mutationFn: (): Promise<TradeCoachReview> => {
      if (!tradeId) throw new Error("missing trade id");
      return tradesApi.coach(tradeId);
    },
  });

  return {
    coachConfigured,
    settingsPending: settings.isPending,
    isPending: mutation.isPending,
    isError: mutation.isError,
    data: mutation.data,
    error: mutation.error,
    generate: mutation.mutateAsync,
    reset: mutation.reset,
  };
}
