import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TradeDetailView } from "../app/screens/TradeDetailView";
import { useTradeDetail, usePatchTrade } from "../lib/hooks/useTradeDetail";
import { useSetups } from "../lib/hooks/useSetups";
import { useTags } from "../lib/hooks/useTags";
import { useAttachments, useUploadAttachment, useDeleteAttachment } from "../lib/hooks/useAttachments";
import type { JournalFormState } from "../app/screens/TradeDetailView";

export const Route = createFileRoute("/trades/$id")({
  component: TradeDetailPage,
});

function TradeDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const detailQ = useTradeDetail(id);
  const setupsQ = useSetups();
  const tagsQ = useTags();
  const attachmentsQ = useAttachments(id);

  const patchMutation = usePatchTrade();
  const uploadMutation = useUploadAttachment(id);
  const deleteMutation = useDeleteAttachment(id);

  function handleSave(form: JournalFormState) {
    patchMutation.mutate({
      id,
      body: {
        notes: form.notes,
        setup_id: form.setup_id || undefined,
        initial_risk: form.initial_risk ? parseFloat(form.initial_risk) : undefined,
        tag_ids: form.tag_ids,
      },
    });
  }

  function handleUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    uploadMutation.mutate(fd);
  }

  function handleDeleteAttachment(attachmentId: string) {
    deleteMutation.mutate(attachmentId);
  }

  return (
    <TradeDetailView
      trade={detailQ.data}
      loading={detailQ.isLoading}
      error={detailQ.isError}
      setups={setupsQ.data ?? []}
      allTags={tagsQ.data ?? []}
      attachments={attachmentsQ.data ?? []}
      attachmentsLoading={attachmentsQ.isLoading}
      saving={patchMutation.isPending}
      uploading={uploadMutation.isPending}
      onSave={handleSave}
      onUpload={handleUpload}
      onDeleteAttachment={handleDeleteAttachment}
      onBack={() => navigate({ to: "/trades" })}
    />
  );
}
