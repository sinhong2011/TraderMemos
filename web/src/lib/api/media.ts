import { apiFetch, getBaseUrl } from "./client";

export interface MediaFile {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export const MEDIA_SRC_PREFIX = "tm-media:";

export function mediaSrc(id: string): string {
  return `${MEDIA_SRC_PREFIX}${id}`;
}

export function parseMediaId(src: string | null | undefined): string | null {
  if (!src?.startsWith(MEDIA_SRC_PREFIX)) return null;
  const id = src.slice(MEDIA_SRC_PREFIX.length).trim();
  return id || null;
}

export const mediaApi = {
  upload: (formData: FormData) =>
    apiFetch<MediaFile>("/media", {
      method: "POST",
      body: formData,
    }),
  fileUrl: (mediaId: string) => `${getBaseUrl()}/media/${mediaId}/file`,
  delete: (mediaId: string) =>
    apiFetch<void>(`/media/${mediaId}`, {
      method: "DELETE",
    }),
};
