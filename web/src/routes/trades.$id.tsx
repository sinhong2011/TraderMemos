import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	type AddFillInput,
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
import { useCreateExecutions } from "../lib/hooks/useExecutions";
import { useSetups } from "../lib/hooks/useSetups";
import { useTags } from "../lib/hooks/useTags";
import { usePatchTrade, useTradeDetail } from "../lib/hooks/useTradeDetail";

export const Route = createFileRoute("/trades/$id")({
	component: TradeDetailPage,
});

function TradeDetailPage() {
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const toast = useToastManager();

	const detailQ = useTradeDetail(id);
	const setupsQ = useSetups();
	const tagsQ = useTags();
	const attachmentsQ = useAttachments(id);

	const patchMutation = usePatchTrade();
	const uploadMutation = useUploadAttachment(id);
	const deleteMutation = useDeleteAttachment(id);
	const addFillMutation = useCreateExecutions();

	function handleSave(form: JournalFormState) {
		patchMutation.mutate(
			{
				id,
				body: {
					notes: form.notes,
					setup_id: form.setup_id || undefined,
					initial_risk: form.initial_risk
						? Number.parseFloat(form.initial_risk)
						: undefined,
					emotional_state: form.emotional_state,
					confidence: form.confidence
						? Number.parseInt(form.confidence, 10)
						: undefined,
					trade_quality: form.trade_quality
						? Number.parseInt(form.trade_quality, 10)
						: undefined,
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
				},
			},
		);
	}

	function handleUpload(file: File) {
		const fd = new FormData();
		fd.append("file", file);
		uploadMutation.mutate(fd);
	}

	function handleDeleteAttachment(attachmentId: string) {
		deleteMutation.mutate(attachmentId);
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
						executed_at: input.executed_at,
					},
				],
			});
			const nextId = result.tradeIds[0];
			toast.add({
				title: "Fill added",
				description: "Position regrouped from executions.",
			});
			if (nextId && nextId !== id) {
				void navigate({ to: "/trades/$id", params: { id: nextId } });
			} else {
				void detailQ.refetch();
			}
		} catch (err) {
			toast.add({
				title: "Could not add fill",
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
			onSave={handleSave}
			onUpload={handleUpload}
			onDeleteAttachment={handleDeleteAttachment}
			onAddFill={handleAddFill}
			onBack={() => navigate({ to: "/trades" })}
		/>
	);
}
