import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  type AddFillInput,
  type DividendFormInput,
  type JournalFormState,
  TradeDetailView,
  journalDraftKey,
} from "../app/screens/TradeDetailView";
import { useToastManager } from "../components/Toast";
import {
  useAttachments,
  useDeleteAttachment,
  useUploadAttachment,
} from "../lib/hooks/useAttachments";
import { useCreateCash } from "../lib/hooks/useCash";
import {
  useCreateExecutions,
  useDeleteExecution,
  useUpdateExecution,
} from "../lib/hooks/useExecutions";
import { useSetups } from "../lib/hooks/useSetups";
import { useTags } from "../lib/hooks/useTags";
import { usePatchTrade, useTradeDetail } from "../lib/hooks/useTradeDetail";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/trades/$id")({
  component: TradeDetailPage,
});

function TradeDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const toast = useToastManager();
  const queryClient = useQueryClient();

  const detailQ = useTradeDetail(id);
  const setupsQ = useSetups();
  const tagsQ = useTags();
  const attachmentsQ = useAttachments(id);

  const patchMutation = usePatchTrade();
  const uploadMutation = useUploadAttachment(id);
  const deleteMutation = useDeleteAttachment(id);
  const addFillMutation = useCreateExecutions();
  const updateFillMutation = useUpdateExecution();
  const deleteFillMutation = useDeleteExecution();
  const createCashMutation = useCreateCash();

  function navigateAfterFillChange(nextId: string | undefined) {
    if (!nextId) {
      void navigate({ to: "/trades" });
      return;
    }
    if (nextId !== id) {
      void navigate({ to: "/trades/$id", params: { id: nextId } });
      return;
    }
    void detailQ.refetch();
  }

  function handleSave(form: JournalFormState) {
    patchMutation.mutate(
      {
        id,
        body: {
          notes: form.notes,
          setup_id: form.setup_ids[0] ?? form.setup_id ?? "",
          setup_ids: form.setup_ids,
          initial_risk: form.initial_risk ? Number.parseFloat(form.initial_risk) : undefined,
          target_price: form.target_price ? Number.parseFloat(form.target_price) : undefined,
          stop_price: form.stop_price ? Number.parseFloat(form.stop_price) : undefined,
          emotional_state: form.emotional_state,
          confidence: form.confidence ? Number.parseInt(form.confidence, 10) : undefined,
          trade_quality: form.trade_quality ? Number.parseInt(form.trade_quality, 10) : undefined,
          mae: form.mae ? Number.parseFloat(form.mae) : undefined,
          mfe: form.mfe ? Number.parseFloat(form.mfe) : undefined,
          tag_ids: form.tag_ids,
        },
      },
      {
        onSuccess: () => {
          try {
            localStorage.removeItem(journalDraftKey(id));
          } catch {
            /* ignore */
          }
          toast.add({
            title: "Journal saved",
            description: "Trade notes and metadata updated.",
          });
        },
        onError: (err) => {
          toast.add({
            title: "Could not save journal",
            description: err instanceof Error ? err.message : "Request failed",
          });
        },
      },
    );
  }

  function handleUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    uploadMutation.mutate(fd, {
      onSuccess: () => {
        toast.add({
          title: "Screenshot uploaded",
          description: file.name,
        });
      },
      onError: (err) => {
        toast.add({
          title: "Upload failed",
          description: err instanceof Error ? err.message : "Request failed",
        });
      },
    });
  }

  function handleDeleteAttachment(attachmentId: string) {
    deleteMutation.mutate(attachmentId, {
      onSuccess: () => {
        toast.add({
          title: "Screenshot removed",
        });
      },
      onError: (err) => {
        toast.add({
          title: "Could not remove screenshot",
          description: err instanceof Error ? err.message : "Request failed",
        });
      },
    });
  }

  async function handleAddFill(input: AddFillInput) {
    const trade = detailQ.data;
    if (!trade) return;
    try {
      const result = await addFillMutation.mutateAsync({
        accountIds: [trade.account_id],
        rows: [
          {
            symbol: trade.symbol,
            instrument_type: trade.instrument_type,
            side: input.side,
            quantity: input.quantity,
            price: input.price,
            fees: input.fees,
            commission: input.commission,
            executed_at: input.executed_at,
          },
        ],
      });
      const nextId = result.tradeIds[0];
      toast.add({
        title: "Fill added",
        description: "Position regrouped from executions.",
      });
      navigateAfterFillChange(nextId);
    } catch (err) {
      toast.add({
        title: "Could not add fill",
        description: err instanceof Error ? err.message : "Request failed",
      });
    }
  }

  async function handleEditFill(fillId: string, input: AddFillInput) {
    try {
      const result = await updateFillMutation.mutateAsync({
        id: fillId,
        body: {
          side: input.side,
          quantity: input.quantity,
          price: input.price,
          fees: input.fees,
          commission: input.commission,
          executed_at: input.executed_at,
        },
      });
      toast.add({
        title: "Fill updated",
        description: "Position regrouped from executions.",
      });
      navigateAfterFillChange(result.trade_id || undefined);
    } catch (err) {
      toast.add({
        title: "Could not update fill",
        description: err instanceof Error ? err.message : "Request failed",
      });
    }
  }

  async function handleDeleteFill(fillId: string) {
    try {
      const result = await deleteFillMutation.mutateAsync(fillId);
      toast.add({
        title: "Fill deleted",
        description: result.trade_id
          ? "Position regrouped from executions."
          : "No fills left — returned to trades.",
      });
      navigateAfterFillChange(result.trade_id || undefined);
    } catch (err) {
      toast.add({
        title: "Could not delete fill",
        description: err instanceof Error ? err.message : "Request failed",
      });
    }
  }

  async function handleSaveDividend(input: DividendFormInput) {
    const trade = detailQ.data;
    if (!trade) return;
    try {
      const signed = trade.direction === "short" ? -Math.abs(input.amount) : Math.abs(input.amount);
      await createCashMutation.mutateAsync({
        account_id: trade.account_id,
        type: "dividend",
        amount: signed,
        currency: trade.pnl_currency,
        occurred_at: new Date(`${input.date}T12:00:00`).toISOString(),
        note: input.note || `${trade.symbol} dividend`,
        trade_id: trade.id,
      });
      await queryClient.invalidateQueries({ queryKey: ["trade", id] });
      await detailQ.refetch();
      toast.add({
        title: "Dividend added",
        description: "Linked to this trade and included in total P&L.",
      });
    } catch (err) {
      toast.add({
        title: "Could not add dividend",
        description: err instanceof Error ? err.message : "Request failed",
      });
    }
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
      addingFill={addFillMutation.isPending}
      mutatingFill={updateFillMutation.isPending || deleteFillMutation.isPending}
      savingDividend={createCashMutation.isPending}
      onSave={handleSave}
      onUpload={handleUpload}
      onDeleteAttachment={handleDeleteAttachment}
      onAddFill={handleAddFill}
      onEditFill={handleEditFill}
      onDeleteFill={handleDeleteFill}
      onSaveDividend={handleSaveDividend}
      onBack={() => navigate({ to: "/trades" })}
    />
  );
}
