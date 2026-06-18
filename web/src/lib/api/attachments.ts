import { apiFetch } from "./client";
import type { TradeAttachment } from "./types";

export const attachmentsApi = {
	// Upload via multipart FormData (file field = "file")
	upload: (tradeId: string, formData: FormData) =>
		apiFetch<TradeAttachment>(`/trades/${tradeId}/attachments`, {
			method: "POST",
			body: formData,
		}),
	list: (tradeId: string) =>
		apiFetch<TradeAttachment[]>(`/trades/${tradeId}/attachments`),
	// Returns the raw file URL (caller opens in new tab or uses as img src)
	fileUrl: (attachmentId: string) => `/api/v1/attachments/${attachmentId}/file`,
	delete: (tradeId: string, attachmentId: string) =>
		apiFetch<void>(`/trades/${tradeId}/attachments/${attachmentId}`, {
			method: "DELETE",
		}),
};
