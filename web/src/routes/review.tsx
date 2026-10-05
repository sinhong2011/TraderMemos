import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ReviewInboxView } from "@/app/screens/ReviewInboxView";
import { useToastManager } from "@/components/Toast";
import { useFilterParams } from "@/lib/filters";
import { useDismissReviewBacklog, useReviewInbox } from "@/lib/hooks/useReviewInbox";
import { usePatchTrade, useTradeDetail } from "@/lib/hooks/useTradeDetail";
import { useTags } from "@/lib/hooks/useTags";

export const Route = createFileRoute("/review")({
  component: ReviewPage,
});

function ReviewPage() {
  const toast = useToastManager();
  const filters = useFilterParams();
  const inboxQ = useReviewInbox(filters.account_id);
  const tagsQ = useTags("mistake");
  const patch = usePatchTrade();
  const dismiss = useDismissReviewBacklog();
  const [index, setIndex] = useState(0);
  const [reviewed, setReviewed] = useState(0);

  const items = inboxQ.data?.items ?? [];
  const current = items[index];
  const detailQ = useTradeDetail(current?.id ?? "");

  return (
    <ReviewInboxView
      items={items}
      loading={inboxQ.isLoading}
      error={inboxQ.isError}
      backlog={inboxQ.data?.backlog ?? 0}
      windowDays={inboxQ.data?.window_days ?? 14}
      detail={detailQ.data}
      detailLoading={detailQ.isLoading}
      mistakeTags={(tagsQ.data ?? []).filter((t) => t.kind === "mistake")}
      index={index}
      onIndexChange={(next) => setIndex(Math.max(0, next))}
      saving={patch.isPending}
      onSave={async (id, body) => {
        try {
          await patch.mutateAsync({ id, body });
          // The saved trade leaves the queue on refetch, so the same index
          // now points at the next one.
          setReviewed((n) => n + 1);
        } catch (err) {
          toast.add({
            title: "Could not save the review",
            description: err instanceof Error ? err.message : "Request failed",
          });
        }
      }}
      dismissing={dismiss.isPending}
      onDismissBacklog={async () => {
        try {
          await dismiss.mutateAsync();
        } catch (err) {
          toast.add({
            title: "Could not dismiss the backlog",
            description: err instanceof Error ? err.message : "Request failed",
          });
        }
      }}
      reviewedThisSession={reviewed}
    />
  );
}
